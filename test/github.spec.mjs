/** GitHub workspaces: path safety, the CLI token, cloning, and the route's answers. */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  assertSegment,
  cloneDestination,
  cloneRepo,
  ghToken,
  handleRequest,
  json,
  scrubToken,
  sameOrigin,
} from '../entries/github.js'

async function scratch() {
  const dir = await mkdtemp(join(tmpdir(), 'polish-github-'))
  return { dir, async done() { await rm(dir, { recursive: true, force: true }) } }
}

test('a repository part that could escape the clone root is refused', () => {
  assert.equal(assertSegment('dsh-aryacode-polish'), 'dsh-aryacode-polish')
  assert.equal(assertSegment('a.b_c-1'), 'a.b_c-1')
  for (const bad of ['..', '.', '', 'a/b', 'a\\b', '../etc']) {
    assert.throws(() => assertSegment(bad), /single path segment/, bad)
  }
  assert.throws(() => assertSegment(undefined), /single path segment/)
})

test('a clone lands at <home>/AryaCode/<owner>/<repo>', () => {
  const home = join('C:', 'Users', 'someone')
  assert.equal(
    cloneDestination('acme', 'rocket', home),
    join(home, 'AryaCode', 'acme', 'rocket'),
  )
})

test('only the same repository counts as the same origin', () => {
  assert.equal(sameOrigin('https://github.com/acme/rocket.git', 'acme', 'rocket'), true)
  assert.equal(sameOrigin('https://github.com/acme/rocket', 'acme', 'rocket'), true)
  assert.equal(sameOrigin('git@github.com:acme/rocket.git\n', 'acme', 'rocket'), true)
  assert.equal(sameOrigin('https://github.com/acme/other.git', 'acme', 'rocket'), false)
  assert.equal(sameOrigin('https://github.com/other/rocket.git', 'acme', 'rocket'), false)
})

test('a token never survives into text the browser could see', () => {
  assert.equal(scrubToken('fatal: unable ghp_secret here', 'ghp_secret'), 'fatal: unable [redacted] here')
  assert.equal(scrubToken('nothing to do', 'ghp_secret'), 'nothing to do')
  assert.equal(scrubToken('kept as is', ''), 'kept as is')
})

test('the GitHub CLI supplies the token, and its absence is not an error', async () => {
  const ok = await ghToken(async () => ({ code: 0, stdout: 'gho_token\n', stderr: '' }))
  assert.equal(ok, 'gho_token')
  const signedOut = await ghToken(async () => ({ code: 1, stdout: '', stderr: 'not logged in' }))
  assert.equal(signedOut, undefined)
  const missing = await ghToken(async () => { throw new Error('spawn gh ENOENT') })
  assert.equal(missing, undefined)
  const blank = await ghToken(async () => ({ code: 0, stdout: '   \n', stderr: '' }))
  assert.equal(blank, undefined)
})

test('status reports the CLI session without one, and the login with one', async () => {
  const signedOut = await handleRequest({ action: 'status' }, { token: async () => undefined })
  assert.equal(signedOut.ok, true)
  assert.equal(signedOut.value.signedIn, false)
  assert.match(signedOut.value.reason, /gh auth login/)

  const signedIn = await handleRequest({ action: 'status' }, {
    token: async () => 'gho_token',
    login: async token => { assert.equal(token, 'gho_token'); return 'acme' },
  })
  assert.equal(signedIn.value.signedIn, true)
  assert.equal(signedIn.value.login, 'acme')
  assert.match(signedIn.value.root, /AryaCode$/)
})

test('repos are marked when their clone already exists under the root', async () => {
  const scratchDir = await scratch()
  try {
    await mkdir(join(scratchDir.dir, 'AryaCode', 'acme', 'exists'), { recursive: true })
    const answer = await handleRequest({ action: 'repos' }, {
      home: scratchDir.dir,
      token: async () => 'gho_token',
      repos: async () => [
        { owner: 'acme', name: 'exists', fullName: 'acme/exists', isPrivate: false, isFork: false, description: '', updatedAt: '', defaultBranch: 'main' },
        { owner: 'acme', name: 'fresh', fullName: 'acme/fresh', isPrivate: true, isFork: true, description: 'new', updatedAt: '', defaultBranch: 'main' },
      ],
    })
    assert.equal(answer.ok, true)
    assert.equal(answer.value.repos[0].cloned, true)
    assert.equal(answer.value.repos[1].cloned, false)
    assert.equal(answer.value.repos[1].isPrivate, true)
  } finally {
    await scratchDir.done()
  }
})

test('clone answers with the directory, and refuses a repository name that escapes', async () => {
  const answer = await handleRequest({ action: 'clone', owner: 'acme', name: 'rocket' }, {
    token: async () => 'gho_token',
    clone: async (owner, name, token) => {
      assert.equal(token, 'gho_token')
      return { path: `/tmp/AryaCode/${owner}/${name}`, reused: false }
    },
  })
  assert.equal(answer.ok, true)
  assert.equal(answer.value.path, '/tmp/AryaCode/acme/rocket')
  assert.equal(answer.value.reused, false)

  await assert.rejects(
    () => handleRequest({ action: 'clone', owner: '..', name: 'rocket' }, { token: async () => 'gho_token' }),
    /single path segment/,
  )
})

test('a missing CLI session refuses the data actions with instructions', async () => {
  const answer = await handleRequest({ action: 'repos' }, { token: async () => undefined })
  assert.equal(answer.ok, false)
  assert.match(answer.error, /gh auth login/)
})

test('an unknown action is an error, not a silent success', async () => {
  const answer = await handleRequest({ action: 'delete-everything' }, { token: async () => 'gho_token' })
  assert.equal(answer.ok, false)
  assert.match(answer.error, /unknown GitHub action/)
})

test('cloning spawns git with the token in the environment, never in the URL or arguments', async () => {
  const scratchDir = await scratch()
  try {
    const calls = []
    const result = await cloneRepo('acme', 'rocket', 'gho_token', {
      home: scratchDir.dir,
      run: async (command, args, options) => {
        calls.push({ command, args, options })
        await mkdir(args[args.length - 1], { recursive: true })
        return { code: 0, stdout: '', stderr: '' }
      },
    })
    assert.equal(result.reused, false)
    assert.equal(result.path, join(scratchDir.dir, 'AryaCode', 'acme', 'rocket'))
    assert.equal(calls.length, 1)
    const [call] = calls
    assert.equal(call.command, 'git')
    assert.deepEqual(call.args.slice(0, 4), ['-c', 'credential.helper=', 'clone', '--progress'])
    assert.equal(call.args[call.args.length - 2], 'https://github.com/acme/rocket.git')
    assert.equal(call.options.env.GIT_CONFIG_KEY_0, 'http.extraHeader')
    assert.match(call.options.env.GIT_CONFIG_VALUE_0, /^Authorization: Basic /)
    assert.equal(call.options.env.GIT_CONFIG_VALUE_0.includes('gho_token'), false)
    assert.equal(call.args.join(' ').includes('gho_token'), false)
  } finally {
    await scratchDir.done()
  }
})

test('an existing checkout of the same repository is reused instead of cloned again', async () => {
  const scratchDir = await scratch()
  try {
    const path = join(scratchDir.dir, 'AryaCode', 'acme', 'rocket')
    await mkdir(path, { recursive: true })
    const calls = []
    const result = await cloneRepo('acme', 'rocket', 'gho_token', {
      home: scratchDir.dir,
      run: async (command, args, options) => {
        calls.push(args)
        if (args[0] === 'remote') return { code: 0, stdout: 'https://github.com/acme/rocket.git\n', stderr: '' }
        return { code: 0, stdout: '', stderr: '' }
      },
    })
    assert.equal(result.reused, true)
    assert.equal(result.path, path)
    assert.deepEqual(calls, [['remote', 'get-url', 'origin']])
  } finally {
    await scratchDir.done()
  }
})

test('a directory that is another repository is a failure, not a silent overwrite', async () => {
  const scratchDir = await scratch()
  try {
    const path = join(scratchDir.dir, 'AryaCode', 'acme', 'rocket')
    await mkdir(path, { recursive: true })
    await writeFile(join(path, 'placeholder.txt'), 'x')
    await assert.rejects(
      () => cloneRepo('acme', 'rocket', 'gho_token', {
        home: scratchDir.dir,
        run: async (command, args) => (args[0] === 'remote'
          ? { code: 0, stdout: 'https://github.com/acme/other.git\n', stderr: '' }
          : { code: 0, stdout: '', stderr: '' }),
      }),
      /already exists and is not acme\/rocket/,
    )
  } finally {
    await scratchDir.done()
  }
})

test('a failed clone reports git stderr with the token scrubbed', async () => {
  const scratchDir = await scratch()
  try {
    await assert.rejects(
      () => cloneRepo('acme', 'rocket', 'gho_token', {
        home: scratchDir.dir,
        run: async () => ({ code: 128, stdout: '', stderr: 'fatal: could not read from gho_token' }),
      }),
      error => {
        assert.match(error.message, /fatal: could not read from/)
        assert.equal(error.message.includes('gho_token'), false)
        return true
      },
    )
  } finally {
    await scratchDir.done()
  }
})

test('the route answers JSON with no-store, so a stale repository list cannot be cached', async () => {
  const response = json({ ok: true, value: 1 })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.match(response.headers.get('content-type'), /application\/json/)
  assert.deepEqual(await response.json(), { ok: true, value: 1 })
})

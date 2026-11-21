/** GitHub workspaces: path safety, the CLI token, cloning, and the route's answers. */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  accountRoot,
  accountStatus,
  assertSegment,
  cancelInstall,
  cancelLogin,
  cloneDestination,
  cloneRepo,
  fetchProfile,
  forgetAvatars,
  ghPresent,
  ghToken,
  handleRequest,
  installStatus,
  json,
  loginStatus,
  listAccounts,
  MAX_AVATAR_BYTES,
  parseDeviceCode,
  parseDeviceUrl,
  readAvatar,
  scrubToken,
  signOut,
  signOutAll,
  sameOrigin,
  startInstall,
  startLogin,
  switchAccount,
  tokenFor,
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
  const signedOut = await handleRequest({ action: 'status' }, { token: async () => undefined, present: async () => true })
  assert.equal(signedOut.ok, true)
  assert.equal(signedOut.value.signedIn, false)
  assert.equal(signedOut.value.installed, true)
  assert.match(signedOut.value.reason, /gh auth login/)

  const signedIn = await handleRequest({ action: 'status' }, {
    token: async () => 'gho_token',
    present: async () => true,
    login: async token => { assert.equal(token, 'gho_token'); return 'acme' },
  })
  assert.equal(signedIn.value.signedIn, true)
  assert.equal(signedIn.value.installed, true)
  assert.equal(signedIn.value.login, 'acme')
  assert.match(signedIn.value.root, /AryaCode$/)
})

test('status tells a missing CLI apart from a signed-out one', async () => {
  const missing = await handleRequest({ action: 'status' }, { token: async () => undefined, present: async () => false })
  assert.equal(missing.ok, true)
  assert.equal(missing.value.installed, false)
  assert.match(missing.value.reason, /not installed/)
})

test('the profile picture never leaves the Host as a URL to fetch', async () => {
  forgetAvatars()
  // One response for the identity, one for the bytes; nothing else is requested.
  const calls = []
  const fetchImpl = async (url, options) => {
    calls.push(String(url))
    if (String(url) === 'https://api.github.com/user') {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          login: 'acme',
          avatar_url: 'https://avatars.githubusercontent.com/u/42',
          id: 42,
          name: 'Acme Person',
        }),
      }
    }
    assert.equal(String(url), 'https://avatars.githubusercontent.com/u/42')
    assert.equal(options.headers.accept, 'image/*', 'the picture is asked for as an image')
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'image/png; charset=binary' },
      arrayBuffer: async () => new Uint8Array([137, 80, 78, 71]).buffer,
    }
  }
  // The id is asked for because it is what turns a noreply address into one that
  // credits the right account, which is the whole point of a two-account machine.
  const profile = await fetchProfile('gho', fetchImpl)
  assert.deepEqual(profile, {
    login: 'acme',
    avatarUrl: 'https://avatars.githubusercontent.com/u/42',
    id: '42',
    name: 'Acme Person',
  })

  const first = await readAvatar('gho', 'acme', { fetchImpl })
  assert.match(first.dataUrl, /^data:image\/png;base64,/, 'the browser receives a data URL')
  assert.equal(first.cached, false)
  const again = await readAvatar('gho', 'acme', { fetchImpl })
  assert.equal(again.cached, true, 'the second read is served from the Host cache')
  assert.equal(calls.filter(url => url.startsWith('https://avatars')).length, 1, 'the picture is downloaded once')
})

test('a profile picture on another host, or too large, is refused', async () => {
  forgetAvatars()
  const elsewhere = async url => {
    if (String(url) === 'https://api.github.com/user') {
      return { ok: true, status: 200, json: async () => ({ login: 'acme', avatar_url: 'https://evil.example/a.png' }) }
    }
    throw new Error('the picture URL must never be requested')
  }
  await assert.rejects(readAvatar('gho', 'acme', { fetchImpl: elsewhere }), /host this Host does not read/)

  const huge = async url => {
    if (String(url) === 'https://api.github.com/user') {
      return {
        ok: true,
        status: 200,
        json: async () => ({ login: 'acme', avatar_url: 'https://avatars.githubusercontent.com/u/42' }),
      }
    }
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'image/png' },
      arrayBuffer: async () => new ArrayBuffer(MAX_AVATAR_BYTES + 1),
    }
  }
  await assert.rejects(readAvatar('gho', 'acme', { fetchImpl: huge }), /larger than 256 KB/)
})

test('the avatar action answers with the picture, not a URL', async () => {
  forgetAvatars()
  const answer = await handleRequest({ action: 'avatar' }, {
    token: async () => 'gho',
    login: async () => 'acme',
    avatar: async (token, login) => {
      assert.equal(token, 'gho')
      assert.equal(login, 'acme')
      return { dataUrl: 'data:image/png;base64,AAAA', cached: false }
    },
  })
  assert.equal(answer.ok, true)
  assert.equal(answer.value.login, 'acme')
  assert.equal(answer.value.dataUrl, 'data:image/png;base64,AAAA')
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

test('the one-time code and device page are read out of what the CLI prints', () => {
  const printed = '! One-time code (ae22-76c7) copied to clipboard\nOpen this URL to continue in your web browser: https://github.com/login/device\n'
  assert.equal(parseDeviceCode(printed), 'AE22-76C7', 'the code is upper-cased and keeps its dash')
  assert.equal(parseDeviceUrl(printed), 'https://github.com/login/device')
  assert.equal(parseDeviceCode('nothing here'), undefined)
  assert.equal(parseDeviceUrl('nothing here'), 'https://github.com/login/device', 'the page is a constant fallback')
})

test('a sign-in surfaces the code the CLI printed, then reports the outcome', async () => {
  const listeners = { stdout: [], stderr: [], close: [], error: [] }
  const child = {
    stdout: { setEncoding() {}, on(_event, handler) { listeners.stdout.push(handler) } },
    stderr: { setEncoding() {}, on(_event, handler) { listeners.stderr.push(handler) } },
    on(event, handler) { listeners[event]?.push(handler) },
    kill() { listeners.close.forEach(handler => handler(null)) },
  }
  const spawned = []
  const started = startLogin({ spawn: (command, args) => { spawned.push({ command, args }); return child }, timeoutMs: 50 })
  assert.equal(started.ok, true)
  assert.equal(spawned[0].command, 'gh')
  assert.deepEqual(spawned[0].args.slice(0, 3), ['auth', 'login', '--hostname'])
  assert.ok(spawned[0].args.includes('--web'))

  listeners.stderr.forEach(handler => handler(Buffer.from('! One-time code (AE22-76C7) copied to clipboard\n')))
  assert.equal(loginStatus().state, 'pending')
  assert.equal(loginStatus().code, 'AE22-76C7')

  listeners.close.forEach(handler => handler(0))
  assert.equal(loginStatus().state, 'succeeded')
  cancelLogin()
  assert.equal(loginStatus().state, 'cancelled')
})

test('a sign-in that is never approved fails instead of hanging forever', async () => {
  const child = {
    stdout: { setEncoding() {}, on() {} },
    stderr: { setEncoding() {}, on(_event, handler) { this.handler = handler; handler(Buffer.from('! One-time code (AAAA-1111) copied to clipboard\n')) } },
    on() {},
    kill() {},
  }
  startLogin({ spawn: () => child, timeoutMs: 10 })
  assert.equal(loginStatus().state, 'pending')
  await new Promise(resolve => setTimeout(resolve, 60))
  assert.equal(loginStatus().state, 'failed')
  assert.match(loginStatus().reason, /expired/)
  cancelLogin()
})

test('signing out removes that account from the CLI and tolerates an absent one', async () => {
  const calls = []
  const gone = await signOut('KonnectSuite', async (command, args) => { calls.push({ command, args }); return { code: 0, stdout: '', stderr: '' } })
  assert.deepEqual(gone, { ok: true })
  assert.deepEqual(calls[0].args, ['auth', 'logout', '--hostname', 'github.com', '--user', 'KonnectSuite'])

  const absent = await signOut('KonnectSuite', async () => ({ code: 1, stdout: '', stderr: 'not logged in to github.com' }))
  assert.deepEqual(absent, { ok: true }, 'already signed out is the state the caller wanted')

  const failed = await signOut('KonnectSuite', async () => ({ code: 1, stdout: '', stderr: 'network is unreachable' }))
  assert.equal(failed.ok, false)
  assert.match(failed.error, /network is unreachable/)
})

test('sign-in and sign-out actions are reachable without a session, and routed by the Host', async () => {
  const signedOut = { token: async () => undefined }
  const login = await handleRequest({ action: 'login' }, { ...signedOut, startLogin: () => ({ ok: true, value: { state: 'pending', code: 'AE22-76C7', url: 'https://github.com/login/device' } }) })
  assert.equal(login.value.code, 'AE22-76C7')
  const poll = await handleRequest({ action: 'loginStatus' }, { ...signedOut, loginStatus: () => ({ state: 'pending', code: 'AE22-76C7', url: '', reason: '' }) })
  assert.equal(poll.value.state, 'pending')
  const cancelled = await handleRequest({ action: 'loginCancel' }, { ...signedOut, cancelLogin: () => ({ state: 'cancelled', code: '', url: '', reason: '' }) })
  assert.equal(cancelled.value.state, 'cancelled')

  const signedIn = await handleRequest({ action: 'logout' }, {
    token: async () => 'gho_token',
    login: async () => 'KonnectSuite',
    signOut: async () => ({ ok: true }),
  })
  assert.deepEqual(signedIn.value, { login: 'KonnectSuite', remaining: 'KonnectSuite' })
})

test('a sign-out reports the account the CLI fell back to', async () => {
  // The real surprise on a two-account machine: logout --user removes one account
  // and the CLI silently makes the next one active.
  let signedOut = false
  const answer = await handleRequest({ action: 'logout' }, {
    token: async () => (signedOut ? 'gho_other' : 'gho_token'),
    login: async () => 'KonnectSuite',
    signOut: async () => { signedOut = true; return { ok: true } },
  })
  assert.deepEqual(answer.value, { login: 'KonnectSuite', remaining: 'KonnectSuite' })

  const lastOne = await handleRequest({ action: 'logout' }, {
    // First read finds the session, the read after the sign-out finds nothing.
    token: (() => { let calls = 0; return async () => { calls += 1; return calls === 1 ? 'gho_token' : undefined } })(),
    login: async () => 'KonnectSuite',
    signOut: async () => ({ ok: true }),
  })
  assert.deepEqual(lastOne.value, { login: 'KonnectSuite', remaining: '' })
})

test('the status names every account the CLI holds, and signing out all removes them', async () => {
  const roster = [
    { login: 'KonnectSuite', active: true, state: 'active', tokenSource: 'keyring', scopes: 'repo, read:org', gitProtocol: 'https' },
    { login: 'KphungFROMM', active: false, state: 'active', tokenSource: 'keyring', scopes: 'repo', gitProtocol: 'https' },
  ]
  const status = await handleRequest({ action: 'status' }, {
    token: async () => 'gho_token',
    login: async () => 'KonnectSuite',
    accountStatus: async () => roster,
  })
  // `accounts` stays the plain list of logins the sign-out path already uses;
  // `accountList` and `active` are what the picker needs on top of it.
  assert.deepEqual(status.value.accounts, ['KonnectSuite', 'KphungFROMM'])
  assert.deepEqual(status.value.accountList, roster)
  assert.equal(status.value.active, 'KonnectSuite')
  assert.equal(status.value.signedIn, true)

  const removed = []
  const all = await handleRequest({ action: 'logoutAll' }, {
    token: async () => 'gho_token',
    accounts: async () => ['KonnectSuite', 'KphungFROMM'],
    signOutAll: async logins => {
      for (const login of logins) removed.push(login)
      return { ok: true, removed: logins.slice() }
    },
  })
  assert.deepEqual(removed, ['KonnectSuite', 'KphungFROMM'])
  assert.deepEqual(all.value, { logins: ['KonnectSuite', 'KphungFROMM'] })

  const none = await handleRequest({ action: 'logoutAll' }, { token: async () => undefined, accounts: async () => [] })
  assert.deepEqual(none.value, { logins: [] })
})

test('the CLI account list is read from the status text it already prints', async () => {
  const text = [
    'github.com',
    '  ✓ Logged in to github.com account KonnectSuite (keyring)',
    '  - Active account: true',
    '',
    '  ✓ Logged in to github.com account KphungFROMM (keyring)',
    '  - Active account: false',
  ].join('\n')
  const logins = await listAccounts(async () => ({ code: 1, stdout: text, stderr: '' }))
  assert.deepEqual(logins, ['KonnectSuite', 'KphungFROMM'])
  const empty = await listAccounts(async () => ({ code: 1, stdout: '', stderr: 'not logged in to any hosts' }))
  assert.deepEqual(empty, [])
})

test('the roster is read from the JSON the CLI answers, with the active account named', async () => {
  // This is the real shape `gh auth status --json hosts` answers on this machine,
  // so the parse is pinned to what the CLI actually prints, not to a guess.
  const payload = {
    hosts: {
      'github.com': [
        { state: 'success', active: true, host: 'github.com', login: 'KonnectSuite', tokenSource: 'keyring', scopes: 'repo, workflow', gitProtocol: 'https' },
        { state: 'success', active: false, host: 'github.com', login: 'KphungFROMM', tokenSource: 'env GITHUB_TOKEN', scopes: '', gitProtocol: 'https' },
      ],
    },
  }
  const asked = []
  const roster = await accountStatus(async (command, args) => {
    asked.push({ command, args })
    return { code: 0, stdout: JSON.stringify(payload), stderr: '' }
  })
  assert.deepEqual(asked, [{ command: 'gh', args: ['auth', 'status', '--json', 'hosts'] }])
  assert.deepEqual(roster.map(entry => entry.login), ['KonnectSuite', 'KphungFROMM'])
  assert.equal(roster[0].active, true)
  assert.equal(roster[1].active, false)
  assert.equal(roster[0].tokenSource, 'keyring')
  assert.equal(roster[0].state, 'success')
})

test('an older CLI that answers in prose still gives a roster, and no CLI gives none', async () => {
  const text = [
    'github.com',
    '  ✓ Logged in to github.com account KonnectSuite (keyring)',
    '  - Active account: true',
    '  ✓ Logged in to github.com account KphungFROMM (keyring)',
    '  - Active account: false',
  ].join('\n')
  const roster = await accountStatus(async () => ({ code: 1, stdout: text, stderr: '' }))
  assert.deepEqual(roster.map(entry => entry.login), ['KonnectSuite', 'KphungFROMM'])
  // The CLI lists the active account first, so the first login is the best guess
  // at which one a terminal would use. It is a guess, and it is the only one prose allows.
  assert.equal(roster[0].active, true)
  assert.equal(roster[1].active, false)
  assert.deepEqual(await accountStatus(async () => { throw new Error('spawn gh ENOENT') }), [],
    'a machine without the CLI has no accounts, which is not an error')
})

test('a named account is read its own token, and a missing session reads as no token', async () => {
  const asked = []
  const token = await tokenFor('KphungFROMM', async (command, args) => {
    asked.push({ command, args })
    return { code: 0, stdout: 'gho_work\n', stderr: '' }
  })
  assert.equal(token, 'gho_work')
  assert.deepEqual(asked, [{ command: 'gh', args: ['auth', 'token', '--hostname', 'github.com', '--user', 'KphungFROMM'] }])
  assert.equal(await tokenFor('nobody', async () => ({ code: 1, stdout: '', stderr: 'no auth data for user nobody' })), undefined)
  assert.equal(await tokenFor('nobody', async () => { throw new Error('spawn gh ENOENT') }), undefined)
})

test('making an account active in the CLI is asked for by name, and a failure is reported', async () => {
  const twoAccounts = {
    hosts: {
      'github.com': [
        { state: 'success', active: false, host: 'github.com', login: 'KonnectSuite', tokenSource: 'keyring', scopes: '', gitProtocol: 'https' },
        { state: 'success', active: true, host: 'github.com', login: 'KphungFROMM', tokenSource: 'keyring', scopes: '', gitProtocol: 'https' },
      ],
    },
  }
  const asked = []
  const switched = await switchAccount('KphungFROMM', async (command, args) => {
    asked.push(args)
    return args[0] === 'switch'
      ? { code: 0, stdout: '', stderr: '' }
      : { code: 0, stdout: JSON.stringify(twoAccounts), stderr: '' }
  })
  assert.equal(switched.ok, true)
  assert.deepEqual(asked[0], ['auth', 'switch', '--hostname', 'github.com', '--user', 'KphungFROMM'])
  assert.equal(switched.accounts.find(entry => entry.active).login, 'KphungFROMM')

  const failed = await switchAccount('nobody', async () => ({ code: 1, stdout: '', stderr: 'no auth data for user nobody' }))
  assert.equal(failed.ok, false)
  assert.match(failed.error, /no auth data for user nobody/)
})

test('a picked account owns its clone folder, and no account keeps the shared one', () => {
  const home = join('C:', 'Users', 'someone')
  assert.equal(accountRoot(home), join(home, 'AryaCode'))
  assert.equal(accountRoot(home, 'work'), join(home, 'AryaCode', 'work'))
  assert.equal(cloneDestination('acme', 'rocket', home, 'work'), join(home, 'AryaCode', 'work', 'acme', 'rocket'))
  assert.throws(() => accountRoot(home, '../escape'), /single path segment/)
})

test('the account list answers while signed out, which is how a second account is found', async () => {
  const answer = await handleRequest({ action: 'accounts' }, {
    token: async () => undefined,
    accountStatus: async () => [
      { login: 'KonnectSuite', active: true, state: 'success', tokenSource: 'keyring', scopes: '', gitProtocol: 'https' },
      { login: 'KphungFROMM', active: false, state: 'success', tokenSource: 'keyring', scopes: '', gitProtocol: 'https' },
    ],
  })
  assert.equal(answer.ok, true)
  assert.deepEqual(answer.value.accounts.map(entry => entry.login), ['KonnectSuite', 'KphungFROMM'])
  assert.equal(answer.value.active, 'KonnectSuite')
})

test('setting the active account names it to the CLI, and a name that could escape is refused', async () => {
  const asked = []
  const answer = await handleRequest({ action: 'setActive', account: 'KphungFROMM' }, {
    token: async () => undefined,
    switchAccount: async login => {
      asked.push(login)
      return { ok: true, accounts: [{ login: 'KphungFROMM', active: true, state: 'success', tokenSource: 'keyring', scopes: '', gitProtocol: 'https' }] }
    },
  })
  assert.deepEqual(asked, ['KphungFROMM'])
  assert.equal(answer.value.active, 'KphungFROMM')

  const failed = await handleRequest({ action: 'setActive', account: 'nobody' }, {
    token: async () => undefined,
    switchAccount: async () => ({ ok: false, error: 'no auth data for user nobody' }),
  })
  assert.equal(failed.ok, false)
  assert.match(failed.error, /no auth data for user nobody/)

  await assert.rejects(
    () => handleRequest({ action: 'setActive', account: '../elsewhere' }, { token: async () => undefined }),
    /single path segment/,
  )
})

test('a named account browses with that account token, and the active one is never asked for', async () => {
  const asked = []
  const answer = await handleRequest({ action: 'repos', account: 'KphungFROMM' }, {
    home: join('C:', 'Users', 'someone'),
    token: async () => { asked.push('active'); return 'gho_active' },
    tokenFor: async login => { asked.push(login); return 'gho_work' },
    repos: async token => { asked.push(token); return [] },
  })
  assert.equal(answer.ok, true)
  assert.deepEqual(asked, ['KphungFROMM', 'gho_work'], 'the active account token is never read for a named account')
})

test('a repository cloned before accounts existed still reads as cloned once an account is picked', async () => {
  const scratchDir = await scratch()
  try {
    await mkdir(join(scratchDir.dir, 'AryaCode', 'acme', 'exists'), { recursive: true })
    const answer = await handleRequest({ action: 'repos', account: 'work' }, {
      home: scratchDir.dir,
      token: async () => 'gho_token',
      tokenFor: async () => 'gho_work',
      repos: async () => [
        { owner: 'acme', name: 'exists', fullName: 'acme/exists', isPrivate: false, isFork: false, description: '', updatedAt: '', defaultBranch: 'main' },
        { owner: 'acme', name: 'fresh', fullName: 'acme/fresh', isPrivate: false, isFork: false, description: '', updatedAt: '', defaultBranch: 'main' },
      ],
    })
    assert.equal(answer.value.repos[0].cloned, true, 'the shared folder is still searched')
    assert.equal(answer.value.repos[1].cloned, false)
    assert.equal(answer.value.root, join(scratchDir.dir, 'AryaCode', 'work'), 'the preview names the account folder')
  } finally {
    await scratchDir.done()
  }
})

test('a named account clones into its own folder', async () => {
  const scratchDir = await scratch()
  try {
    const target = join(scratchDir.dir, 'AryaCode', 'work', 'acme', 'rocket')
    const calls = []
    const result = await cloneRepo('acme', 'rocket', 'gho_work', {
      home: scratchDir.dir,
      account: 'work',
      run: async (command, args) => {
        calls.push(args)
        if (args.includes('clone')) await mkdir(target, { recursive: true })
        return { code: 0, stdout: '', stderr: '' }
      },
    })
    assert.equal(result.reused, false)
    assert.equal(result.path, target)
    assert.equal(calls.length, 1, 'nothing but the clone itself is run')
    assert.equal(calls[0][calls[0].indexOf('--') + 1], 'https://github.com/acme/rocket.git')
    assert.equal(calls[0][calls[0].length - 1], target)
  } finally {
    await scratchDir.done()
  }
})

test('an account clone reuses the checkout made before accounts existed, instead of making a second copy', async () => {
  const scratchDir = await scratch()
  try {
    const legacy = join(scratchDir.dir, 'AryaCode', 'acme', 'rocket')
    await mkdir(legacy, { recursive: true })
    const calls = []
    const result = await cloneRepo('acme', 'rocket', 'gho_work', {
      home: scratchDir.dir,
      account: 'work',
      run: async (command, args) => {
        calls.push(args)
        return args[0] === 'remote'
          ? { code: 0, stdout: 'https://github.com/acme/rocket.git\n', stderr: '' }
          : { code: 0, stdout: '', stderr: '' }
      },
    })
    assert.equal(result.reused, true)
    assert.equal(result.path, legacy, 'the old flat checkout is the one that is kept')
    assert.deepEqual(calls, [['remote', 'get-url', 'origin']], 'no clone is run over an existing checkout')
  } finally {
    await scratchDir.done()
  }
})

test('a fresh clone records the account identity, and only what the repository does not already carry', async () => {
  const scratchDir = await scratch()
  try {
    const target = join(scratchDir.dir, 'AryaCode', 'work', 'acme', 'rocket')
    const calls = []
    const result = await cloneRepo('acme', 'rocket', 'gho_work', {
      home: scratchDir.dir,
      account: 'work',
      identity: async () => ({ name: 'Work Person', email: '99+worky@users.noreply.github.com' }),
      run: async (command, args) => {
        calls.push(args.join(' '))
        if (args.includes('clone')) await mkdir(target, { recursive: true })
        if (args.includes('--get')) return { code: 1, stdout: '', stderr: '' }
        return { code: 0, stdout: '', stderr: '' }
      },
    })
    assert.equal(result.path, target)
    assert.deepEqual(result.identity, {
      'user.name': 'Work Person',
      'user.email': '99+worky@users.noreply.github.com',
    })
    assert.ok(calls.includes('config --local user.name Work Person'))
    assert.ok(calls.includes('config --local user.email 99+worky@users.noreply.github.com'))
    assert.equal(calls.filter(call => call.includes('--get')).length, 2, 'each key is read before it is written')
    // Only --local. The global config belongs to the user's terminal, and this
    // dialog has no business rewriting it for a machine the picker does not own.
    assert.equal(calls.some(call => call.includes('--global')), false)
  } finally {
    await scratchDir.done()
  }
})

test('a repository that already carries an identity is left alone, and a reuse never asks for one', async () => {
  const scratchDir = await scratch()
  try {
    const target = join(scratchDir.dir, 'AryaCode', 'work', 'acme', 'rocket')
    const calls = []
    const cloned = await cloneRepo('acme', 'rocket', 'gho_work', {
      home: scratchDir.dir,
      account: 'work',
      identity: async () => ({ name: 'Work Person', email: '99+worky@users.noreply.github.com' }),
      run: async (command, args) => {
        calls.push(args.join(' '))
        if (args.includes('clone')) await mkdir(target, { recursive: true })
        // The repository carries its own name on purpose; the second read finds it.
        if (args.includes('--get') && args.includes('user.name')) {
          return { code: 0, stdout: 'Repo Bot\n', stderr: '' }
        }
        if (args.includes('--get')) return { code: 1, stdout: '', stderr: '' }
        return { code: 0, stdout: '', stderr: '' }
      },
    })
    assert.deepEqual(cloned.identity, { 'user.email': '99+worky@users.noreply.github.com' }, 'only the missing key is written')
    assert.equal(calls.includes('config --local user.name Work Person'), false, 'the value the repository chose is kept')

    const asked = []
    const reused = await cloneRepo('acme', 'rocket', 'gho_work', {
      home: scratchDir.dir,
      account: 'work',
      identity: async () => { asked.push('asked'); return { name: 'Work Person', email: '99+worky@users.noreply.github.com' } },
      run: async (command, args) => (args[0] === 'remote'
        ? { code: 0, stdout: 'https://github.com/acme/rocket.git\n', stderr: '' }
        : { code: 0, stdout: '', stderr: '' }),
    })
    assert.equal(reused.reused, true)
    assert.deepEqual(asked, [], 'a checkout that already exists never pays for a profile request')
  } finally {
    await scratchDir.done()
  }
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

test('the CLI is present when `gh --version` answers and missing when it cannot run', async () => {
  assert.equal(await ghPresent(async () => ({ code: 0, stdout: 'gh version 2.63.0', stderr: '' })), true)
  assert.equal(await ghPresent(async () => ({ code: 1, stdout: '', stderr: 'not found' })), false)
  assert.equal(await ghPresent(async () => { throw new Error('spawn gh ENOENT') }), false)
})

test('an install spawns winget for the GitHub CLI and reports its outcome', () => {
  const listeners = {}
  const child = {
    on(event, handler) { listeners[event] = handler },
    kill() {},
  }
  const spawned = []
  const started = startInstall({
    spawn: (command, args) => { spawned.push({ command, args }); return child },
    timeoutMs: 60_000,
  })
  assert.equal(started.ok, true)
  assert.equal(started.value.state, 'pending')
  assert.equal(spawned[0].command, 'winget')
  assert.deepEqual(spawned[0].args, [
    'install', '--id', 'GitHub.cli', '-e',
    '--accept-source-agreements', '--accept-package-agreements',
  ])
  assert.equal(installStatus().state, 'pending')
  listeners.close(0)
  assert.equal(installStatus().state, 'succeeded')
  assert.match(installStatus().reason, /Relaunch AryaCode/)
  cancelInstall()
})

test('a winget install that dies names the code, and a machine without winget names the fix', () => {
  const listeners = {}
  const child = {
    on(event, handler) { listeners[event] = handler },
    kill() {},
  }
  startInstall({ spawn: () => child, timeoutMs: 60_000 })
  listeners.close(3)
  assert.equal(installStatus().state, 'failed')
  assert.match(installStatus().reason, /stopped with code 3/)
  assert.match(installStatus().reason, /winget install GitHub\.cli/)
  cancelInstall()

  const threw = startInstall({
    spawn: () => { throw new Error('spawn winget ENOENT') },
    timeoutMs: 60_000,
  })
  assert.equal(threw.ok, false)
  assert.equal(installStatus().state, 'failed')
  assert.match(installStatus().reason, /winget/)
  cancelInstall()
})

test('an install that never finishes fails on its own timer instead of hanging', async () => {
  const child = { on() {}, kill() {} }
  startInstall({ spawn: () => child, timeoutMs: 10 })
  assert.equal(installStatus().state, 'pending')
  await new Promise(resolve => { setTimeout(resolve, 60) })
  assert.equal(installStatus().state, 'failed')
  assert.match(installStatus().reason, /did not finish in time/)
  cancelInstall()
})

test('install actions are reachable without a sign-in, and routed by the Host', async () => {
  const signedOut = { token: async () => undefined }
  const install = await handleRequest({ action: 'install' }, {
    ...signedOut,
    startInstall: () => ({ ok: true, value: { state: 'pending', reason: '' } }),
  })
  assert.equal(install.ok, true)
  assert.equal(install.value.state, 'pending')
  const poll = await handleRequest({ action: 'installStatus' }, {
    ...signedOut,
    installStatus: () => ({ state: 'pending', reason: '' }),
  })
  assert.equal(poll.value.state, 'pending')
  const cancelled = await handleRequest({ action: 'installCancel' }, {
    ...signedOut,
    cancelInstall: () => ({ state: 'cancelled', reason: 'install was cancelled' }),
  })
  assert.equal(cancelled.value.state, 'cancelled')
})

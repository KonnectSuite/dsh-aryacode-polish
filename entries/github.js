/**
 * GitHub workspaces: sign in through the GitHub CLI's existing session, list
 * repositories, and clone one under the clone root so it can be adopted as a
 * workspace.
 *
 * The browser half never sees the token. It posts to one route and gets back
 * JSON; every GitHub call and every `git` invocation happens here.
 */

import { spawn } from 'node:child_process'
import { mkdir, realpath, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

/** Absolute path the Host registers; the browser addresses `api/polish.github`. */
export const GITHUB_ROUTE = '/api/polish.github'

/** Root a clone lands in: `<home>/AryaCode/<owner>/<repo>`. */
export function cloneRoot(home = homedir()) {
  return join(home, 'AryaCode')
}

const SEGMENT = /^[A-Za-z0-9_.-]+$/

/**
 * Reject a repository part that could escape the clone root.
 * @param value - owner or repository name from GitHub.
 * @returns the same value when it is one plain path segment.
 */
export function assertSegment(value) {
  if (typeof value !== 'string' || !SEGMENT.test(value) || value === '.' || value === '..') {
    throw new Error('repository name must be a single path segment')
  }
  return value
}

/**
 * Directory one repository clones into.
 * @param owner - repository owner.
 * @param name - repository name.
 * @param home - home directory to root the default clone tree in.
 * @returns absolute destination path.
 */
export function cloneDestination(owner, name, home = homedir()) {
  return join(cloneRoot(home), assertSegment(owner), assertSegment(name))
}

/**
 * Whether a git origin URL already points at this repository.
 * @param origin - `git remote get-url origin` output.
 * @param owner - repository owner.
 * @param name - repository name.
 * @returns true for either the https or the ssh form of the same repo.
 */
export function sameOrigin(origin, owner, name) {
  const normalized = String(origin).trim().replace(/\.git$/i, '').replace(/\/+$/, '').toLowerCase()
  return normalized === `https://github.com/${owner}/${name}`.toLowerCase()
    || normalized === `git@github.com:${owner}/${name}`.toLowerCase()
}

/**
 * Run a program and collect its output. Never throws on a non-zero exit.
 * @param command - executable name.
 * @param args - arguments.
 * @param options - extra environment and working directory.
 * @returns exit code plus captured stdout and stderr.
 */
export function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never', ...options.env },
      windowsHide: true,
    })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', chunk => { stdout += chunk })
    child.stderr.on('data', chunk => { stderr += chunk })
    child.on('error', reject)
    child.on('close', code => { resolve({ code: code ?? 1, stdout, stderr }) })
  })
}

/**
 * Remove the token from text that may reach the browser.
 * @param text - command output.
 * @param token - access token.
 * @returns text with every occurrence replaced.
 */
export function scrubToken(text, token) {
  if (token === undefined || token === '') return text
  return String(text).split(token).join('[redacted]')
}

/**
 * Ask the GitHub CLI for the token it already holds.
 *
 * Nothing is stored by this plugin: when `gh` is signed out, the feature says
 * so instead of collecting a credential of its own.
 * @param run - command runner, injected by tests.
 * @returns the token, or undefined when `gh` is missing or signed out.
 */
export async function ghToken(run = runCommand) {
  let answer
  try {
    answer = await run('gh', ['auth', 'token'])
  } catch {
    return undefined
  }
  if (answer.code !== 0) return undefined
  const token = answer.stdout.trim()
  return token === '' ? undefined : token
}

/**
 * Read the login that owns a token.
 * @param token - GitHub access token.
 * @param fetchImpl - HTTP implementation.
 * @returns the login name.
 */
export async function fetchLogin(token, fetchImpl = fetch) {
  const response = await fetchImpl('https://api.github.com/user', { headers: githubHeaders(token) })
  if (!response.ok) throw new Error(`GitHub sign-in check failed (${String(response.status)})`)
  const body = await response.json()
  const login = body?.login
  if (typeof login !== 'string' || login === '') throw new Error('GitHub did not return a login')
  return login
}

/**
 * List repositories the token can clone, most recently updated first.
 * @param token - GitHub access token.
 * @param fetchImpl - HTTP implementation.
 * @param pages - most pages of 100 to read.
 * @returns repository rows in list order.
 */
export async function fetchRepos(token, fetchImpl = fetch, pages = 3) {
  const repos = []
  let url = 'https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member'
  for (let page = 0; page < pages && url !== undefined; page += 1) {
    const response = await fetchImpl(url, { headers: githubHeaders(token) })
    if (!response.ok) throw new Error(`GitHub repository list failed (${String(response.status)})`)
    const body = await response.json()
    if (!Array.isArray(body)) throw new Error('GitHub repository list was not an array')
    for (const item of body) {
      const row = readRepo(item)
      if (row !== undefined) repos.push(row)
    }
    url = nextLink(response.headers.get('link'))
  }
  return repos
}

function githubHeaders(token) {
  return {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${token}`,
    'user-agent': 'aryacode-polish',
  }
}

function readRepo(value) {
  if (value === null || typeof value !== 'object') return undefined
  const name = value.name
  const owner = value.owner !== null && typeof value.owner === 'object' ? value.owner.login : undefined
  if (typeof name !== 'string' || typeof owner !== 'string') return undefined
  return {
    owner,
    name,
    fullName: typeof value.full_name === 'string' ? value.full_name : `${owner}/${name}`,
    isPrivate: value.private === true,
    isFork: value.fork === true,
    description: typeof value.description === 'string' ? value.description : '',
    updatedAt: typeof value.updated_at === 'string' ? value.updated_at : '',
    defaultBranch: typeof value.default_branch === 'string' ? value.default_branch : '',
  }
}

function nextLink(header) {
  if (typeof header !== 'string' || header === '') return undefined
  for (const part of header.split(',')) {
    const match = /<([^>]+)>;\s*rel="next"/.exec(part)
    if (match?.[1] !== undefined) return match[1]
  }
  return undefined
}

async function directoryExists(path) {
  try {
    return (await stat(path)).isDirectory()
  } catch {
    return false
  }
}

async function existingRealpath(path) {
  try {
    return await realpath(path)
  } catch {
    return undefined
  }
}

/**
 * Clone a repository, or reuse a directory whose origin is already that repo.
 *
 * The token travels in git's environment as an http header, never in the
 * remote URL and never on the command line, so it cannot leak through `ps` or
 * a stored remote.
 * @param owner - repository owner.
 * @param name - repository name.
 * @param token - GitHub access token.
 * @param options - command runner, home directory and optional progress sink.
 * @returns destination path and whether an existing checkout was kept.
 */
export async function cloneRepo(owner, name, token, options = {}) {
  const run = options.run ?? runCommand
  const path = cloneDestination(owner, name, options.home)
  const progress = options.progress ?? (() => {})
  if (await directoryExists(path)) {
    const origin = await run('git', ['remote', 'get-url', 'origin'], { cwd: path })
    if (origin.code === 0 && sameOrigin(origin.stdout, owner, name)) {
      progress(`Reusing the existing checkout at ${path}`)
      return { path, reused: true }
    }
    throw new Error(`${path} already exists and is not ${owner}/${name}`)
  }
  await mkdir(dirname(path), { recursive: true })
  progress(`Cloning ${owner}/${name} into ${path}`)
  // GitHub's git server rejects a bearer token, so it is presented as basic auth
  // through an extra http header in git's own environment.
  const header = `Authorization: Basic ${Buffer.from(`x-access-token:${token}`).toString('base64')}`
  const cloned = await run(
    'git',
    ['-c', 'credential.helper=', 'clone', '--progress', '--', `https://github.com/${owner}/${name}.git`, path],
    {
      env: {
        GIT_CONFIG_COUNT: '1',
        GIT_CONFIG_KEY_0: 'http.extraHeader',
        GIT_CONFIG_VALUE_0: header,
      },
    },
  )
  if (cloned.code !== 0) {
    throw new Error(scrubToken(cloned.stderr || cloned.stdout || 'git clone failed', token))
  }
  return { path, reused: false }
}

/**
 * Answer one browser request.
 * @param body - parsed request body.
 * @param deps - injected GitHub and git implementations.
 * @returns the JSON value the browser half renders.
 */
export async function handleRequest(body, deps = {}) {
  const action = body?.action
  const token = await (deps.token ?? ghToken)()
  if (action === 'status') {
    if (token === undefined) {
      return {
        ok: true,
        value: { signedIn: false, login: '', root: cloneRoot(deps.home), reason: 'The GitHub CLI is missing or not signed in: run `gh auth login` in a terminal.' },
      }
    }
    const login = await (deps.login ?? fetchLogin)(token)
    return { ok: true, value: { signedIn: true, login, root: cloneRoot(deps.home), reason: '' } }
  }
  if (token === undefined) {
    return { ok: false, error: 'Sign in with the GitHub CLI first: run `gh auth login` in a terminal, then try again.' }
  }
  if (action === 'repos') {
    const repos = await (deps.repos ?? fetchRepos)(token)
    const marked = []
    for (const repo of repos) {
      const real = await existingRealpath(cloneDestination(repo.owner, repo.name, deps.home))
      marked.push({ ...repo, cloned: real !== undefined })
    }
    return { ok: true, value: { root: cloneRoot(deps.home), repos: marked } }
  }
  if (action === 'clone') {
    const owner = assertSegment(body.owner)
    const name = assertSegment(body.name)
    const result = await (deps.clone ?? cloneRepo)(owner, name, token, { home: deps.home })
    return { ok: true, value: { path: result.path, reused: result.reused } }
  }
  return { ok: false, error: `unknown GitHub action: ${String(action)}` }
}

/**
 * JSON response helper.
 * @param value - payload to serialize.
 * @param status - HTTP status.
 * @returns a JSON response.
 */
export function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

/** Mount the route on a context that provides the `connection` service. */
export const githubFeature = {
  name: 'polish-github',
  inject: ['connection'],
  apply(ctx, config = {}) {
    ctx.effect(() => ctx.connection.fetch.register({
      path: GITHUB_ROUTE,
      // Without a method list the platform would only route GET, which is why the
      // browser's POST would fall through to the static handler as a 404.
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: async (request) => {
        if (request.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405)
        let body
        try {
          body = await request.json()
        } catch {
          return json({ ok: false, error: 'body must be JSON' }, 400)
        }
        try {
          const deps = {
            home: typeof config.home === 'string' && config.home !== '' ? config.home : undefined,
          }
          return json(await handleRequest(body, deps))
        } catch (error) {
          const message = error instanceof Error ? error.message : 'GitHub request failed'
          return json({ ok: false, error: message })
        }
      },
    }))
  },
}

/**
 * Register one child fiber carrying the GitHub route when a profile mounts the
 * feature. Kept separate from the switch so turning the switch off removes the
 * route together with every other surface.
 * @param ctx - the row's context.
 * @returns the mounted fiber.
 */
export function mountGithub(ctx, config = {}) {
  return ctx.plugin({ ...githubFeature, config })
}

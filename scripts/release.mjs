#!/usr/bin/env node
/**
 * Release this bundle: bump, changelog, build, test, commit, push, publish,
 * then wait until the registry actually answers.
 *
 * The order is the point. Every step here has, at some point, been done by hand
 * and one of them was skipped, which is how a machine ended up running files
 * that `package.json` did not name. See `docs/releasing.md` for why each step
 * exists and what "done" looks like for it.
 *
 * Usage:
 *   node scripts/release.mjs --patch|--minor|--major [--title "…"] [--note file.md]
 *   node scripts/release.mjs --version 0.116.0 …
 *   node scripts/release.mjs --minor --dry-run
 *
 * `--dry-run` runs the preflight and the tests, prints the plan, and touches
 * nothing: no file is written, no commit, no publish.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const manifestPath = join(root, 'package.json')
const changelogPath = join(root, 'CHANGELOG.md')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const NAME = manifest.name

/** Printed lines are prefixed so a long npm/git transcript stays readable. */
const log = message => process.stdout.write(`\n• ${message}\n`)

/** Run a command in the repo, inheriting stdio; throw with the command name on failure. */
function run(command, args) {
  try {
    execFileSync(command, args, { cwd: root, stdio: 'inherit' })
  } catch {
    throw new Error(`${command} ${args.join(' ')} failed`)
  }
}

/**
 * npm is a `.cmd` shim on Windows, which `execFileSync` refuses to execute
 * without a shell; `git` and `node` are real executables and stay shell-free.
 */
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm'

/** Run npm, through the shim when the platform needs one. */
function runNpm(args) {
  try {
    execFileSync(NPM, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' })
  } catch {
    throw new Error(`npm ${args.join(' ')} failed`)
  }
}

/** Capture a command's stdout, trimmed. */
function capture(command, args, shell = false) {
  return execFileSync(command, args, { cwd: root, encoding: 'utf8', shell }).trim()
}

/** Parse the arguments this script accepts; unknown flags are an error, not a silent no-op. */
function parseArgs(argv) {
  const options = { dryRun: false, skipTests: false, title: '', note: '', version: '' }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--dry-run') options.dryRun = true
    else if (arg === '--skip-tests') options.skipTests = true
    else if (arg === '--patch' || arg === '--minor' || arg === '--major') options.bump = arg.slice(2)
    else if (arg === '--version') options.version = argv[++index] ?? ''
    else if (arg === '--title') options.title = argv[++index] ?? ''
    else if (arg === '--note') options.note = argv[++index] ?? ''
    else throw new Error(`unknown argument "${arg}"`)
  }
  if (options.version === '' && options.bump === undefined) throw new Error('pass --patch, --minor, --major or --version')
  return options
}

/** The next version, from the current one and the requested bump. */
function nextVersion(current, options) {
  if (options.version !== '') {
    if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(options.version)) throw new Error(`"${options.version}" is not a version`)
    return options.version
  }
  const [major, minor, patch] = current.split('-')[0].split('.').map(Number)
  if (options.bump === 'major') return `${major + 1}.0.0`
  if (options.bump === 'minor') return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
}

/** Refuse to release from a tree whose state nobody can describe afterwards. */
function preflight() {
  const branch = capture('git', ['branch', '--show-current'])
  if (branch !== 'main') throw new Error(`on branch "${branch}", not "main"`)
  const dirty = capture('git', ['status', '--porcelain'])
  if (dirty !== '') throw new Error(`working tree is not clean:\n${dirty}`)
  try {
    capture(NPM, ['whoami'], process.platform === 'win32')
  } catch {
    throw new Error('npm is not authenticated (`npm whoami` failed)')
  }
}

/** Every spec file, run as its own process; `node --test <dir>` spawns a runner that this sandbox blocks. */
function runTests() {
  const files = readdirSync(join(root, 'test')).filter(file => file.endsWith('.spec.mjs')).sort()
  const failed = []
  for (const file of files) {
    const output = execFileSync(process.execPath, [join(root, 'test', file)], { cwd: root, encoding: 'utf8' })
    const fail = /ℹ fail (\d+)/.exec(output)
    if (fail !== null && Number(fail[1]) > 0) failed.push(file)
  }
  if (failed.length > 0) throw new Error(`failing specs: ${failed.join(', ')}`)
  return files.length
}

/** The changelog section for this release: the note file, or the title as one bullet. */
function changelogSection(version, options) {
  const date = new Date().toISOString().slice(0, 10)
  const body = options.note !== '' ? readFileSync(join(root, options.note), 'utf8').trim() : `- ${options.title || '(no note)'}`
  return `## [${version}] - ${date}\n\n${body}\n\n`
}

/** Poll the registry until the version resolves; a staged upload answers 202/409 first. */
async function waitForRegistry(version, attempts = 12) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(`https://registry.npmjs.org/${NAME.replace('/', '%2F')}/${version}`)
      if (response.ok) {
        const document = await response.json()
        log(`registry answers ${version} (${document.dist?.shasum ?? 'no shasum'})`)
        return true
      }
      log(`registry ${response.status} for ${version} — still processing (${attempt}/${attempts})`)
    } catch (error) {
      log(`registry unreachable (${error.message}) — retrying (${attempt}/${attempts})`)
    }
    await new Promise(resolve => setTimeout(resolve, 15000))
  }
  return false
}

const options = parseArgs(process.argv.slice(2))
preflight()

const version = nextVersion(manifest.version, options)
const title = options.title || `Release ${version}`
log(`${NAME}: ${manifest.version} → ${version}${options.dryRun ? ' (dry run)' : ''}`)

const count = options.skipTests ? 0 : runTests()
if (!options.skipTests) log(`${count} spec files pass`)

if (options.dryRun) {
  log('dry run: would bump package.json, prepend CHANGELOG.md, rebuild lib/client.js,')
  log(`commit "${title}", push to origin/main, publish ${version}, wait for the registry.`)
  process.exit(0)
}

manifest.version = version
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
log('package.json bumped')

const changelog = readFileSync(changelogPath, 'utf8')
writeFileSync(changelogPath, changelogSection(version, options) + changelog, 'utf8')
log('CHANGELOG.md updated')

run(process.execPath, [join(root, 'scripts/build-client.mjs')])
log('lib/client.js rebuilt (its CLIENT_VERSION reads the new manifest)')

run('git', ['add', 'package.json', 'CHANGELOG.md', 'lib/client.js'])
run('git', ['commit', '-m', title])
run('git', ['push', 'origin', 'main'])
log('committed and pushed')

runNpm(['publish', '--access', 'public'])

const visible = await waitForRegistry(version)
if (!visible) {
  log(`${version} is not visible yet. That is the staged-upload window, not a failed publish.`)
  log('Re-check with: npm view ' + NAME + '@' + version + ' version')
  process.exit(1)
}

log('')
log('Published. Now install it where it should run — never copy files into node_modules:')
log(`  cd $env:USERPROFILE\\.aryacode\\profiles\\desktop`)
log(`  node "<AryaCode>\\resources\\runtime\\primary-runtime\\dependencies\\pnpm\\bin\\pnpm.mjs" add ${NAME}@${version} --save-exact`)
log('Then reload the plugin (host code) and the page (client bundle).')

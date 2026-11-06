/**
 * billion-context's compaction gate, as this bundle can observe it.
 *
 * `billion-context` ("bili") is an HTTP proxy plus a DSH plugin bundle that
 * compresses the outgoing model request. It owns the context lane when it runs,
 * so an Arya preset that mounts its own summarizer would put two compressors on
 * one history. bili enforces that for the shipped presets by disabling the
 * `@deepseek-ai/dsh-compaction-basic` and `@deepseek-ai/dsh-command-compact`
 * rows by package name; our presets mount different engine modules, so bili's
 * name-based walk cannot see them. This module is how the definition learns to
 * stand down instead.
 *
 * Two facts must BOTH hold before an Arya preset stands down:
 *
 *   1. `ctx.get('biliBasicCompactionPolicy')` resolves — the service bili's
 *      always-on `bili-compaction-gate` entry publishes (bili 0.1.212,
 *      `dist/agent/dsh-compaction-gate.js`, issue #3354/#3662);
 *   2. `globalThis.__BILI_DSH_COMPACTION_VERDICT__ === 'active'` — the verdict
 *      `bili-native`'s `apply()` declares once its plan keeps the lane owned.
 *
 * Neither is a published contract. `biliBasicCompactionPolicy` is an internal
 * service name and the verdict is a global convention between two bili entries,
 * so every reference here is wrapped in a constant, absence is fail-open (the
 * engine runs, stock behaviour), and the warning is one line, never a throw.
 *
 * The pair is checked once before the "is bili expected in this profile?" test:
 * an already-armed bili stands the preset down even when `profileContext` names
 * no bili bundle, because a custom preset or a profile-local patch can mount
 * bili directly. The kill switches still outrank it, matching bili's own plan.
 * The expected-profile test only decides whether a not-yet-armed bili is worth
 * waiting for.
 *
 * This is a DEFINITION-TIME stand-down, not an `internal/config` overlay. The
 * overlay bili registers at load time walks resolved entry configs; a preset
 * registered through the Host's `agentPresets.register()` is not an entry, so
 * that overlay cannot reach it. The definition reads the gate once, just before
 * it is built, which is also the only place a row can be written `disabled`.
 *
 * Timing: when bili is expected but its gate has not published yet, wait 25 ms
 * per tick for up to 2000 ms. Once the service appears, allow 500 ms for the
 * `active` verdict. Timeout, a missing service or an inactive verdict all mean
 * "keep the engine", with one warning, because a double compressor is better
 * than silently disabling compaction when bili is not actually compressing.
 *
 * @module dsh-aryacode-polish-billion-context
 */

/** The service bili's always-on gate entry publishes. Internal; bili 0.1.212. */
export const BILI_GATE_SERVICE = 'biliBasicCompactionPolicy'

/** The process-global verdict bili-native sets when it owns the context lane. */
export const BILI_VERDICT_GLOBAL = '__BILI_DSH_COMPACTION_VERDICT__'

/** The only verdict value that means bili is compressing this process. */
export const BILI_VERDICT_ACTIVE = 'active'

/** The bundle package name that marks bili as installed in the profile. */
export const BILI_BUNDLE_NAME = 'billion-context'

/**
 * Environment variables that name an attach-mode proxy. A launcher (`bili dsh`)
 * or an explicit attach owns routing this way, which means bili is compressing
 * even when the bundle is not listed in the profile.
 */
export const BILI_ATTACH_ENV = Object.freeze(['BILLION_CONTEXT_PROXY', 'BILLION_CONTEXT_ATTACH'])

/**
 * Environment kill switches bili itself honors (`=== '0'`): with either set,
 * `bili-native` plans `mode: "off"`, never declares the verdict, and hands the
 * lane back to stock DSH compaction.
 */
export const BILI_KILL_ENV = Object.freeze(['BILLION_CONTEXT_PLUGIN', 'BILI_NATIVE_DSH'])

/**
 * Environment variable that stands the native plugin down whenever it is
 * defined at all (bili reads `!== undefined`, not a boolean value).
 */
export const BILI_REWRITES_ENV = 'BILI_PROVIDER_REWRITES'

/** Poll cadence and the two waits, in milliseconds. */
export const BILI_TIMING = Object.freeze({ pollMs: 25, gateMs: 2000, verdictMs: 500 })

/** The one warning logged when bili is expected but the gate never latched. */
export const BILI_STAND_DOWN_WARNING =
  'billion-context is installed but its compaction gate did not become active; keeping the Arya compaction engine and /compact mounted'

/**
 * Whether bili's own kill switches say the native plugin is off.
 *
 * Mirrors `planNativeDsh()` in bili's `dist/agent/dsh-native.js`: the two
 * switches are compared with `=== '0'`, and a DEFINED `BILI_PROVIDER_REWRITES`
 * is enough (console/value irrelevant).
 *
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env] the environment.
 * @returns {boolean} true when bili cannot be compressing this process.
 */
export function isBiliKillSwitched(env = process.env) {
  try {
    if (env === null || typeof env !== 'object') return false
    for (const name of BILI_KILL_ENV) {
      if (env[name] === '0') return true
    }
    return env[BILI_REWRITES_ENV] !== undefined
  } catch {
    return false
  }
}

/**
 * Whether the environment points at an attach-mode proxy.
 * @param {Record<string, string | undefined>} [env] the environment.
 * @returns {boolean} true when `BILLION_CONTEXT_PROXY`/`BILLION_CONTEXT_ATTACH` is set.
 */
function hasAttachEnv(env) {
  for (const name of BILI_ATTACH_ENV) {
    const value = env[name]
    if (typeof value === 'string' && value.trim() !== '') return true
  }
  return false
}

/**
 * Whether any parsed `--patch` overlay row names the bili package.
 *
 * A launcher passes its native-plugin overlay through `--patch`; the rows are
 * `PatchOptions`, so the name can sit on the row itself or inside `insert`
 * (nested groups included). This is a bounded, cycle-safe string scan, not a
 * structural interpretation: a row is "bili" when its text contains the package
 * name, which is exactly what the profile would mount.
 *
 * @param {unknown} overlays `profileContext.overlays`.
 * @returns {boolean} true when a bili row is mentioned.
 */
function overlaysMentionBili(overlays) {
  if (!Array.isArray(overlays)) return false
  const stack = [...overlays]
  const seen = new Set()
  let visited = 0
  while (stack.length > 0) {
    const value = stack.pop()
    if (typeof value === 'string') {
      if (value.includes(BILI_BUNDLE_NAME)) return true
      continue
    }
    if (value === null || typeof value !== 'object') continue
    if (seen.has(value)) continue
    seen.add(value)
    visited += 1
    if (visited > 4096) return false
    if (Array.isArray(value)) {
      for (const item of value) stack.push(item)
      continue
    }
    for (const key of Object.keys(value)) {
      const child = value[key]
      if (typeof child === 'string') {
        if (child.includes(BILI_BUNDLE_NAME)) return true
      } else if (child !== null && typeof child === 'object') {
        stack.push(child)
      }
    }
  }
  return false
}

/**
 * Whether this process should expect bili to own compaction.
 *
 * Three signals, in bili's own precedence: kill switches first (they outrank
 * the attach variables in `planNativeDsh`), then an attach-mode proxy from the
 * environment, then the mounted profile's startup bundles, then the parsed
 * `--patch` overlays.
 *
 * A profile that simply lists `billion-context` in `dsh.profile.bundles` is the
 * common case: the bundle layer mounts the gate entry whether or not
 * `bili-native` is enabled, so the negative case still has to be detected
 * through the kill switches rather than the bundle.
 *
 * @param {{ startedBundles?: unknown, overlays?: unknown } | undefined | null} profileContext
 *   the Host's `profileContext` service, or anything else.
 * @param {Record<string, string | undefined>} [env] the environment.
 * @returns {boolean} true when bili is expected to compress this process.
 */
export function isBiliExpected(profileContext, env = process.env) {
  try {
    if (isBiliKillSwitched(env)) return false
    if (hasAttachEnv(env)) return true
    if (profileContext === null || typeof profileContext !== 'object') return false
    const bundles = profileContext.startedBundles
    if (Array.isArray(bundles) && bundles.some((name) => typeof name === 'string' && name.includes(BILI_BUNDLE_NAME))) {
      return true
    }
    return overlaysMentionBili(profileContext.overlays)
  } catch {
    return false
  }
}

/**
 * Whether bili-native declared this process's lane owned.
 * @param {object} [scope] the global scope to read; `globalThis` by default.
 * @returns {boolean} true for the exact `'active'` verdict.
 */
export function isBiliVerdictActive(scope = globalThis) {
  try {
    return scope !== null && typeof scope === 'object' && scope[BILI_VERDICT_GLOBAL] === BILI_VERDICT_ACTIVE
  } catch {
    return false
  }
}

/**
 * Resolve one optional service without letting an unready context throw.
 * @param {object} ctx the plugin context.
 * @param {string} name the service name.
 * @returns {any} the service, or undefined.
 */
function readService(ctx, name) {
  try {
    if (ctx === null || typeof ctx !== 'object' || typeof ctx.get !== 'function') return undefined
    return ctx.get(name)
  } catch {
    return undefined
  }
}

/** The default wait: a real timer. Injected by tests so no spec sleeps. */
const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Log the one warning. Logging is best-effort: a composition with no logger, or
 * a logger that throws, must not turn a fail-open decision into a crash.
 * @param {object} ctx the plugin context.
 */
function warnOnce(ctx) {
  try {
    ctx?.logger?.warn?.(BILI_STAND_DOWN_WARNING)
  } catch {
    // A logger failure is not a reason to change the decision.
  }
}

/**
 * Whether the definition should disable its compaction engine and `/compact`.
 *
 * Call this once, immediately before building a preset definition, and pass the
 * result as `standDownCompaction`. The function never rejects and never throws:
 * any unexpected failure resolves to `false` (keep the engine), because a
 * duplicate summarizer is recoverable and a silently missing one is not.
 *
 * @param {object} ctx the feature's cordis context (only `get` and `logger` are read).
 * @param {{
 *   profileContext?: unknown,
 *   env?: Record<string, string | undefined>,
 *   scope?: object,
 *   sleep?: (ms: number) => Promise<unknown>,
 *   timing?: { pollMs?: number, gateMs?: number, verdictMs?: number },
 * }} [options] test seams; production passes none.
 * @returns {Promise<boolean>} true only when bili's gate service exists AND its
 *   verdict is `active`.
 */
export async function resolveStandDown(ctx, options = {}) {
  try {
    const opts = options !== null && typeof options === 'object' ? options : {}
    const env = opts.env ?? process.env
    if (isBiliKillSwitched(env)) return false
    const scope = opts.scope ?? globalThis

    // An already-armed bili wins before any "do we expect bili?" reasoning. A
    // custom preset or a profile-local patch can mount bili directly, without
    // the bundle appearing in `startedBundles` or `overlays`; if the gate
    // service AND the active verdict are both live, bili owns the lane and no
    // further signal matters. The kill switches above still outrank this,
    // exactly as they outrank attach mode in bili's own plan.
    const armedGate = readService(ctx, BILI_GATE_SERVICE) !== undefined
    if (armedGate && isBiliVerdictActive(scope)) return true

    const profileContext = opts.profileContext ?? readService(ctx, 'profileContext')
    if (!isBiliExpected(profileContext, env)) return false

    const sleep = typeof opts.sleep === 'function' ? opts.sleep : defaultSleep
    const rawTiming = opts.timing !== null && typeof opts.timing === 'object' ? opts.timing : {}
    const pollMs = Number.isFinite(rawTiming.pollMs) && rawTiming.pollMs > 0 ? rawTiming.pollMs : BILI_TIMING.pollMs
    const gateMs = Number.isFinite(rawTiming.gateMs) && rawTiming.gateMs >= 0 ? rawTiming.gateMs : BILI_TIMING.gateMs
    const verdictMs =
      Number.isFinite(rawTiming.verdictMs) && rawTiming.verdictMs >= 0 ? rawTiming.verdictMs : BILI_TIMING.verdictMs

    const gatePresent = () => readService(ctx, BILI_GATE_SERVICE) !== undefined

    // The gate entry may publish after the profile starts; poll for the service.
    // A service already read for the armed check counts as present, so the
    // poll never re-reads the gate it has just resolved.
    let appeared = armedGate
    if (!appeared) {
      const gatePolls = Math.max(1, Math.ceil(gateMs / pollMs))
      for (let tick = 0; tick < gatePolls; tick += 1) {
        await sleep(pollMs)
        if (gatePresent()) {
          appeared = true
          break
        }
      }
    }

    if (appeared) {
      // The service can exist before bili-native declares the verdict; give the
      // verdict a short grace instead of treating "not yet" as "inactive".
      const verdictPolls = Math.max(1, Math.ceil(verdictMs / pollMs))
      for (let tick = 0; tick <= verdictPolls; tick += 1) {
        if (isBiliVerdictActive(scope)) return true
        if (tick === verdictPolls) break
        await sleep(pollMs)
      }
    }

    warnOnce(ctx)
    return false
  } catch {
    return false
  }
}

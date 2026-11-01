/**
 * The engineering ledger the Engineering tab renders.
 *
 * A session's tools already say what happened; this projection folds those events
 * into the five steps of the engineering loop, so the tab can answer "what was
 * read, what was checked, what was written, what was verified, and what is still a
 * human step" without re-reading the transcript.
 *
 * The fold is deliberately literal: it classifies tool names, keeps the last
 * result per check, and never infers that a step passed when the tool that would
 * prove it never ran. A failed check stays visible until another attempt replaces
 * it.
 *
 * Event shapes (read from a live session log):
 *   tool/call   { turn, step, callId, name, arguments }   arguments is a JSON string
 *   tool/result { turn, step, message: { toolCallId, isError, content }, meta }
 *   approval/*  { policy } / gate events
 *
 * @module dsh-aryacode-polish-arya-automation-projection
 */

import { z } from 'zod'

/** The projection key the client asks for. */
export const ARYA_AUTOMATION_PROJECTION_KEY = 'aryaAutomation'

/** Most checks kept for display. */
const CHECK_LIMIT = 12

/** Most artifacts kept for display. */
const ARTIFACT_LIMIT = 8

/** Most call ids remembered for result correlation. */
const CALL_LIMIT = 256

/** Tool-name classes, matched by prefix then exact. */
const READ = new Set([
  'open_project', 'list_components', 'get_component', 'find_references', 'trace_dependencies',
  'resolve_tag', 'usage_map', 'project_overview', 'read_live_tag', 'read_live_tags', 'poll_live_tags',
  'ftview_open', 'ftview_list', 'ftview_get', 'ftview_find', 'ftview_live_map', 'ftview_cross_reference',
  'mw_project_find', 'mw_project_overview', 'mw_get', 'mw_list', 'mw_references', 'mw_search', 'mw_help',
  'optix_status', 'optix_read', 'optix_netlogic',
  'slc_read', 'inspect_artifact', 'migration_plan',
])

const CHECK = new Set([
  'run_checks', 'ftview_check', 'ftview_design_check', 'ftview_theme_audit', 'ftview_validate',
  'verify_offline_l5x', 'build_acd_from_draft', 'compare_projects', 'compare_functions',
  'migration_assess', 'migration_compare', 'migration_resolve', 'migration_report',
  'mw_validate', 'mw_review', 'mw_compile', 'optix_validate_expression',
  'l5x_lint', 'l5k_lint', 'ftview_verify_import', 'ftview_studio_preflight',
])

const WRITE = new Set([
  'draft_rung', 'draft_st', 'draft_tag', 'draft_tag_description', 'draft_udt_description',
  'draft_udt_member', 'draft_routine', 'draft_apply', 'compose_rung', 'compose_batch',
  'ftview_draft_display_add', 'ftview_draft_display_attrs', 'ftview_draft_display_create',
  'ftview_draft_display_scaffold', 'ftview_draft_display_set', 'ftview_draft_object_add',
  'ftview_draft_object_delete', 'ftview_draft_object_order', 'ftview_draft_object_set',
  'ftview_draft_drop', 'ftview_draft_ops', 'ftview_draft_popup', 'ftview_draft_restyle',
  'ftview_draft_screen', 'ftview_draft_tag_upsert', 'ftview_draft_tags', 'ftview_apply',
  'mw_edit_code', 'mw_edit_structure', 'mw_edit_variables', 'mw_insert_block', 'mw_apply',
  'optix_edit', 'optix_action',
])

const VERIFY = new Set([
  'verify_offline_l5x', 'build_acd_from_draft', 'ftview_verify_import', 'ftview_render',
  'mw_compile', 'l5x_rung_preview', 'l5x_routine_diagram', 'l5x_diagram',
])

const LIVE = new Set([
  'read_live_tag', 'read_live_tags', 'poll_live_tags', 'start_plc_trend',
  'read_controller_clock', 'read_controller_mode', 'write_live_tag', 'write_controller_clock',
  'change_controller_mode', 'capture_controller_snapshot', 'download_project', 'go_online',
  'discover_controllers',
])

const LIVE_WRITE = new Set([
  'write_live_tag', 'write_controller_clock', 'change_controller_mode', 'download_project',
])

/**
 * Classify one tool name.
 * @param {string} name the tool name.
 * @returns {'verify'|'check'|'write'|'read'|'live'|null} its step, or null when it is not engineering.
 */
export function classifyTool(name) {
  if (typeof name !== 'string' || name.length === 0) return null
  // Verify before check: the same name can be in both sets (a build is a check).
  if (VERIFY.has(name)) return 'verify'
  if (CHECK.has(name)) return 'check'
  if (LIVE.has(name)) return 'live'
  if (WRITE.has(name)) return 'write'
  if (READ.has(name)) return 'read'
  return null
}

/** Artifact argument keys, with the label the tab shows. */
const ARTIFACT_KEYS = [
  ['path', 'file'],
  ['l5x_path', 'l5x'],
  ['acd_path', 'acd'],
  ['snapshot_path', 'acd'],
  ['root', 'folder'],
  ['application', 'application'],
  ['project', 'project'],
  ['project_id', 'project'],
  ['ip_address', 'controller'],
  ['tag', 'tag'],
]

/**
 * Pull the artifact a call named, if it named one.
 * @param {string} argumentsJson the raw argument string.
 * @returns {{ kind: string, value: string } | null} the artifact.
 */
function artifactOf(argumentsJson) {
  let args
  try {
    args = typeof argumentsJson === 'string' ? JSON.parse(argumentsJson) : argumentsJson
  } catch {
    return null
  }
  if (args === null || typeof args !== 'object') return null
  for (const [key, kind] of ARTIFACT_KEYS) {
    const value = args[key]
    if (typeof value === 'string' && value.trim().length > 0) return { kind, value: value.trim() }
  }
  return null
}

const stageSchema = z.object({
  id: z.string(),
  label: z.string(),
  done: z.boolean(),
  detail: z.string(),
})

const wireSchema = z.object({
  hasActivity: z.boolean(),
  stages: z.array(stageSchema),
  artifacts: z.array(z.object({ kind: z.string(), value: z.string(), tool: z.string() })),
  checks: z.array(z.object({ name: z.string(), ok: z.boolean(), at: z.number() })),
  gates: z.object({ asked: z.number(), decided: z.number(), policy: z.string() }),
  live: z.object({ reads: z.number(), writes: z.number() }),
  last: z.object({ name: z.string(), ok: z.boolean(), at: z.number() }).nullable(),
  failures: z.number(),
})

const labels = {
  read: 'Read',
  check: 'Checks',
  write: 'Write',
  verify: 'Verify',
  live: 'Live / hand-off',
}

/**
 * Fold one session event into the ledger.
 * @param {object} state the current state.
 * @param {{ type: string, data?: any, time?: number }} event one durable session event.
 * @returns {object} the next state.
 */
export function applyEngineering(state, event) {
  const type = event?.type
  const data = event?.data
  const at = typeof event?.time === 'number' ? event.time : 0

  if (type === 'tool/call' && data !== null && typeof data === 'object') {
    const name = typeof data.name === 'string' ? data.name : ''
    const callId = typeof data.callId === 'string' ? data.callId : ''
    const step = classifyTool(name)
    if (step === null) return state
    const calls = { ...state.calls }
    const order = [...state.callOrder, callId]
    if (callId !== '') calls[callId] = name
    const trimmedOrder = order.length > CALL_LIMIT ? order.slice(-CALL_LIMIT) : order
    const artifacts = [...state.artifacts]
    const artifact = artifactOf(data.arguments)
    if (artifact !== null) {
      artifacts.push({ ...artifact, tool: name })
      if (artifacts.length > ARTIFACT_LIMIT) artifacts.splice(0, artifacts.length - ARTIFACT_LIMIT)
    }
    const seen = { ...state.seen }
    seen[step] = (seen[step] ?? 0) + 1
    const live = { ...state.live }
    if (step === 'live') {
      if (LIVE_WRITE.has(name)) live.writes += 1
      else live.reads += 1
    }
    return { ...state, calls, callOrder: trimmedOrder, artifacts, seen, live }
  }

  if (type === 'tool/result' && data !== null && typeof data === 'object') {
    const message = data.message !== null && typeof data.message === 'object' ? data.message : {}
    const callId = typeof message.toolCallId === 'string' ? message.toolCallId : ''
    const name = state.calls[callId]
    const step = classifyTool(name)
    if (step === null) return state
    const ok = message.isError !== true
    const at2 = at
    if (step === 'check' || step === 'verify') {
      const checks = [...state.checks.filter((entry) => entry.name !== name), { name, step, ok, at: at2 }]
      if (checks.length > CHECK_LIMIT) checks.splice(0, checks.length - CHECK_LIMIT)
      const passed = { ...state.passed }
      if (ok) passed[step] = true
      else if (passed[step] !== true) passed[step] = false
      return {
        ...state,
        checks,
        passed,
        failures: state.failures + (ok ? 0 : 1),
        last: { name, ok, at: at2 },
      }
    }
    if (ok) {
      const passed = { ...state.passed, [step]: true }
      if (step === 'live') passed.live = true
      return { ...state, passed, last: { name, ok, at: at2 } }
    }
    return { ...state, last: { name, ok, at: at2 } }
  }

  if (type === 'approval/asked' && data !== null && typeof data === 'object') {
    return { ...state, gates: { ...state.gates, asked: state.gates.asked + 1 } }
  }
  if (type === 'approval/decided' && data !== null && typeof data === 'object') {
    return { ...state, gates: { ...state.gates, decided: state.gates.decided + 1 } }
  }
  if (type === 'approval/policy' && data !== null && typeof data === 'object') {
    const policy = typeof data.policy === 'string' ? data.policy : ''
    return { ...state, gates: { ...state.gates, policy } }
  }
  return state
}

/**
 * Build the projection the registry mounts.
 * @returns {object} a `sessionProjections.register()` argument.
 */
export function createAryaAutomationProjection() {
  return {
    key: ARYA_AUTOMATION_PROJECTION_KEY,
    stateVersion: 1,
    stateSchema: z.object({
      calls: z.record(z.string()),
      callOrder: z.array(z.string()),
      artifacts: z.array(z.object({ kind: z.string(), value: z.string(), tool: z.string() })),
      checks: z.array(z.object({ name: z.string(), step: z.string(), ok: z.boolean(), at: z.number() })),
      seen: z.record(z.number()),
      passed: z.record(z.boolean()),
      gates: z.object({ asked: z.number(), decided: z.number(), policy: z.string() }),
      live: z.object({ reads: z.number(), writes: z.number() }),
      last: z.object({ name: z.string(), ok: z.boolean(), at: z.number() }).nullable(),
      failures: z.number(),
    }),
    init: () => ({
      calls: {},
      callOrder: [],
      artifacts: [],
      checks: [],
      seen: {},
      passed: {},
      gates: { asked: 0, decided: 0, policy: '' },
      live: { reads: 0, writes: 0 },
      last: null,
      failures: 0,
    }),
    apply: applyEngineering,
    wire: {
      viewSchema: wireSchema,
      view: (state) => {
        const order = ['read', 'check', 'write', 'verify', 'live']
        const stageDone = {
          read: (state.seen.read ?? 0) > 0,
          check: (state.passed.check ?? false) || (state.seen.check ?? 0) > 0,
          write: state.passed.write === true,
          verify: state.passed.verify === true,
          live: (state.seen.live ?? 0) > 0,
        }
        const stageDetail = {
          read: `${state.seen.read ?? 0} read${(state.seen.read ?? 0) === 1 ? '' : 's'}`,
          check: (state.seen.check ?? 0) === 0
            ? 'no check yet'
            : state.failures > 0 ? `${state.failures} failing` : 'passing',
          write: state.passed.write === true ? 'applied' : (state.seen.write ?? 0) > 0 ? 'staged' : 'no edit yet',
          verify: state.passed.verify === true ? 'verified' : 'not verified',
          live: state.live.writes > 0 ? `${state.live.writes} live write` : (state.seen.live ?? 0) > 0 ? `${state.live.reads} live read` : 'none',
        }
        const hasActivity = state.artifacts.length > 0 || state.checks.length > 0 || Object.keys(state.seen).length > 0
        return {
          hasActivity,
          stages: order.map((id) => ({ id, label: labels[id], done: stageDone[id] === true, detail: stageDetail[id] })),
          artifacts: state.artifacts.slice().reverse(),
          checks: state.checks.slice().reverse(),
          gates: state.gates,
          live: state.live,
          last: state.last,
          failures: state.failures,
        }
      },
    },
  }
}

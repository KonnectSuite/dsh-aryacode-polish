const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
const swap = (from, to) => {
  if (!src.includes(from)) throw new Error('missing anchor: ' + from.slice(0, 70))
  src = src.replace(from, to)
}

/* presets: a look you can reuse without retyping tone, weight and glyph */
swap(`const LOOK_KEY = 'aryacode-polish:workspace-appearance.v1'`,
`const LOOK_KEY = 'aryacode-polish:workspace-appearance.v1'
const PRESET_KEY = 'aryacode-polish:workspace-presets.v1'

/** The part of a look worth keeping: tone, weight and glyph, never the note. */
export function lookOf(map, workspaceId) {
  const look = appearanceOf(map, workspaceId)
  return { tone: look.tone, strong: look.strong, glyph: look.glyph }
}

export function readPresets(storage) {
  try {
    const store = storage || (typeof localStorage === 'undefined' ? undefined : localStorage)
    if (!store) return {}
    const parsed = JSON.parse(store.getItem(PRESET_KEY) || '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function writePresets(map, storage) {
  try {
    const store = storage || (typeof localStorage === 'undefined' ? undefined : localStorage)
    if (!store) return
    store.setItem(PRESET_KEY, JSON.stringify(map || {}))
  } catch {
    /* a preset is a convenience */
  }
}

/** Add or replace a preset; the name is trimmed and capped, and empty looks are refused. */
export function withPreset(map, name, look) {
  const key = String(name || '').trim().slice(0, 24)
  if (!key) return map || {}
  const clean = { tone: look && look.tone, strong: look && look.strong === true, glyph: look && look.glyph }
  if (!clean.tone && !clean.glyph && !clean.strong) return map || {}
  return Object.assign({}, map || {}, { [key]: clean })
}

export function withoutPreset(map, name) {
  const next = Object.assign({}, map || {})
  delete next[String(name || '').trim()]
  return next
}

/** Preset names, newest last but stable, so the menu does not reorder itself. */
export function presetNames(map) {
  return Object.keys(map || {}).sort((a, b) => a.localeCompare(b))
}`)

fs.writeFileSync(p, src)
console.log('preset helpers added')

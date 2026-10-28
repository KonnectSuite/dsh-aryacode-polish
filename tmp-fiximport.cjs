const fs = require('node:fs')
const p = 'test/workspace.spec.mjs'
let s = fs.readFileSync(p, 'utf8')
s = s.replace(`import {
  folderLookOf,
  withFolderLook,
  FOLDER_LOOK_PREFIX, describe, it } from 'node:test'`, `import { describe, it } from 'node:test'`)
s = s.replace(`import {
  filterTree,`, `import {
  folderLookOf,
  withFolderLook,
  FOLDER_LOOK_PREFIX,
  filterTree,`)
fs.writeFileSync(p, s)
console.log('imports repaired')

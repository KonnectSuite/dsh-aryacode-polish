/**
 * The Host half of inline previews: hand the chat one file's bytes.
 *
 * The card in `client/preview.js` runs model-authored HTML, so the read behind it
 * is deliberately narrow — absolute path, known extension, regular file, size cap —
 * and answers a refusal in words rather than letting an unexpected shape through.
 * It is not a general file reader: no directory listing, no globbing, no write.
 *
 * The route is the same documented shape every other polish route uses: a
 * registered `connection.fetch` path answering JSON.
 */
import { promises as fs } from 'node:fs'
import { basename, extname, isAbsolute, resolve } from 'node:path'
import { json } from './github.js'

/** Absolute path the Host registers; the browser uses {@link PREVIEW_ROUTE}. */
export const PREVIEW_PATH = '/api/polish.preview'

/** Document-relative form the card calls with `fetch`. */
export const PREVIEW_ROUTE = PREVIEW_PATH.slice(1)

/** Markup this card frames; everything else is refused, including `.js`. */
const MARKUP_EXTENSIONS = new Set(['.html', '.htm', '.svg'])

/** Raster formats an `<img>` can carry as a data URL. */
const IMAGE_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
}

/** A framed document is markup a person reads, not a build artifact: half a megabyte is generous. */
export const PREVIEW_MAX_MARKUP_BYTES = 512 * 1024

/** An image is the whole content of the card, so it gets a larger ceiling and a stricter one than "whatever the disk has". */
export const PREVIEW_MAX_IMAGE_BYTES = 8 * 1024 * 1024

/**
 * What this route will do with one path.
 *
 * @param path - absolute file path.
 * @returns `'markup'`, `'image'`, or undefined when the route refuses it.
 */
export function previewKindOf(path) {
  const extension = extname(typeof path === 'string' ? path : '').toLowerCase()
  if (MARKUP_EXTENSIONS.has(extension)) return 'markup'
  return Object.prototype.hasOwnProperty.call(IMAGE_TYPES, extension) ? 'image' : undefined
}

/**
 * Read one previewable file.
 *
 * @param input - absolute path as the chat recorded it.
 * @returns `{ kind, name, bytes, text }` for markup, `{ kind, name, bytes, mime, dataUrl }` for an image.
 * @throws when the path is not absolute, not a regular file, or too large.
 */
export async function readPreview(input) {
  if (typeof input !== 'string' || input === '') throw new Error('a file path is required')
  if (!isAbsolute(input)) throw new Error('a preview needs an absolute path')
  const path = resolve(input)
  const kind = previewKindOf(path)
  if (kind === undefined) throw new Error('this file type is not previewed in the chat')
  const info = await fs.stat(path)
  if (info.isFile() === false) throw new Error('only a regular file can be previewed')
  const limit = kind === 'markup' ? PREVIEW_MAX_MARKUP_BYTES : PREVIEW_MAX_IMAGE_BYTES
  if (info.size > limit) throw new Error(`this file is larger than ${Math.floor(limit / 1024)} KB`)
  const name = basename(path)
  if (kind === 'markup') {
    return { kind, name, bytes: info.size, text: await fs.readFile(path, 'utf8') }
  }
  const type = IMAGE_TYPES[extname(path).toLowerCase()]
  const bytes = await fs.readFile(path)
  return { kind, name, bytes: info.size, mime: type, dataUrl: `data:${type};base64,${bytes.toString('base64')}` }
}

/**
 * Answer one request from the browser.
 *
 * @param body - `{ action: 'read', path }`.
 * @returns a Response with a JSON body.
 */
export async function handlePreview(body) {
  const action = body?.action
  if (action !== 'read') return json({ error: `unknown action ${String(action)}` }, 400)
  try {
    return json({ ok: true, value: await readPreview(body.path) })
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : 'cannot read that file' }, 400)
  }
}

/** The host half mounted by the `inlinePreviews` feature. */
export const previewFeature = {
  name: 'polish-preview',
  inject: ['connection'],
  apply(ctx) {
    ctx.effect(() => ctx.connection.fetch.register({
      path: PREVIEW_PATH,
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: async request => {
        if (request.method !== 'POST') return json({ error: 'POST required' }, 405)
        let body
        try {
          body = await request.json()
        } catch {
          return json({ error: 'a JSON body is required' }, 400)
        }
        return handlePreview(body)
      },
    }))
  },
}

/**
 * Mount the preview route for one configuration.
 *
 * @param ctx - the row's context.
 * @param config - the row's resolved configuration accessor.
 * @returns the mounted plugin fiber.
 */
export function mountPreview(ctx, config) {
  return ctx.plugin({ ...previewFeature, config })
}

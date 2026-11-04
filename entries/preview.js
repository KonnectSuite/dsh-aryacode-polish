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
import { basename, dirname, extname, isAbsolute, resolve, sep } from 'node:path'
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
 * One sibling file may be folded into the framed document, but not to the point
 * where the card is reading a second project: 512 KB each, 2 MB in total.
 */
export const PREVIEW_MAX_ASSET_BYTES = 512 * 1024
export const PREVIEW_MAX_INLINED_BYTES = 2 * 1024 * 1024
export const PREVIEW_MAX_ASSETS = 24

/**
 * What a framed document may pull from beside itself.
 *
 * A document that links `style.css` and `script.js` renders nothing inside a
 * `srcdoc` frame — there is no base URL to resolve them against, and the frame's
 * policy refuses network reads — so the Host folds them in. Anything not listed
 * here is left exactly as the author wrote it.
 */
const ASSET_RENDERING = {
  '.css': 'style',
  '.js': 'script',
  '.mjs': 'script',
  '.svg': 'image',
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.gif': 'image',
  '.webp': 'image',
}

/** The reference forms this route will not follow. */
function relativeReference(reference) {
  const text = typeof reference === 'string' ? reference.trim() : ''
  if (text === '' || text.startsWith('#') || text.startsWith('/') || text.startsWith('\\')) return undefined
  if (/^[a-z][a-z0-9+.-]*:/i.test(text)) return undefined
  return text
}

/**
 * Resolve one relative reference inside the document's own folder.
 * @param reference - the value written in the document.
 * @param baseDir - the folder the document lives in.
 * @returns absolute path inside that folder, or undefined when it escapes it.
 */
export function resolveAsset(reference, baseDir) {
  const relative = relativeReference(reference)
  if (relative === undefined) return undefined
  // The document's folder arrives in whatever form the caller had; normalising it
  // is what makes the prefix test below reliable on a Windows path.
  const base = resolve(baseDir)
  const path = resolve(base, relative)
  const prefix = base.endsWith(sep) ? base : base + sep
  return path.startsWith(prefix) ? path : undefined
}

/**
 * Fold a document's relative styles, scripts and images into itself.
 *
 * A block that cannot be read — a missing file, a size above the cap, an
 * extension this route does not carry — is left exactly as written, so a partial
 * page still renders instead of the whole preview failing.
 *
 * @param source - the document text.
 * @param baseDir - the folder it sits in.
 * @param options - injected reader and caps, for the tests.
 * @returns the rewritten document and how many references were folded in.
 */
export async function inlineAssets(source, baseDir, options = {}) {
  const read = options.readFile ?? fs.readFile
  const stat = options.stat ?? fs.stat
  const maxBytes = options.maxAssetBytes ?? PREVIEW_MAX_ASSET_BYTES
  const maxTotal = options.maxInlinedBytes ?? PREVIEW_MAX_INLINED_BYTES
  const maxAssets = options.maxAssets ?? PREVIEW_MAX_ASSETS
  const html = typeof source === 'string' ? source : ''

  const references = []
  const note = reference => {
    if (references.length >= maxAssets) return
    if (!references.includes(reference)) references.push(reference)
  }
  for (const match of html.matchAll(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi)) {
    if (/rel=["']?stylesheet/i.test(match[0])) note(match[1])
  }
  for (const match of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) note(match[1])
  for (const match of html.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) note(match[1])

  const folded = new Map()
  let total = 0
  for (const reference of references) {
    const path = resolveAsset(reference, baseDir)
    if (path === undefined) continue
    const extension = extname(path).toLowerCase()
    const rendering = ASSET_RENDERING[extension]
    if (rendering === undefined) continue
    try {
      const info = await stat(path)
      if (info.isFile() === false || info.size > maxBytes || total + info.size > maxTotal) continue
      const bytes = await read(path)
      total += bytes.byteLength
      if (rendering === 'style' || rendering === 'script') {
        folded.set(reference, { rendering, raw: bytes.toString('utf8') })
      } else {
        const type = extension === '.svg' ? 'image/svg+xml' : IMAGE_TYPES[extension]
        folded.set(reference, { rendering, raw: 'data:' + type + ';base64,' + bytes.toString('base64') })
      }
    } catch {
      // A reference this Host cannot read stays as the author wrote it.
    }
  }

  if (folded.size === 0) return { text: html, inlined: 0 }

  let text = html.replace(/<link\b[^>]*>/gi, tag => {
    if (/rel=["']?stylesheet/i.test(tag) === false) return tag
    const href = /\bhref=["']([^"']+)["']/i.exec(tag)?.[1]
    const replacement = href === undefined ? undefined : folded.get(href)
    return replacement === undefined ? tag : '<style data-polish-inlined>' + replacement.raw + '</style>'
  })
  text = text.replace(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>\s*<\/script>/gi, (tag, reference) => {
    const replacement = folded.get(reference)
    if (replacement === undefined) return tag
    // A module script keeps its type; an ordinary one is already the default.
    const open = /type=["']module["']/i.test(tag)
      ? '<script type="module" data-polish-inlined>'
      : '<script data-polish-inlined>'
    return open + replacement.raw + '</script>'
  })
  text = text.replace(/<img\b[^>]*>/gi, tag => {
    const src = /\bsrc=["']([^"']+)["']/i.exec(tag)?.[1]
    const replacement = src === undefined ? undefined : folded.get(src)
    return replacement === undefined || replacement.rendering !== 'image'
      ? tag
      : tag.replace(/\bsrc=["'][^"']+["']/i, 'src="' + replacement.raw + '"')
  })
  return { text, inlined: folded.size }
}

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
    const source = await fs.readFile(path, 'utf8')
    const framed = await inlineAssets(source, dirname(path))
    return { kind, name, bytes: info.size, text: framed.text, inlinedAssets: framed.inlined }
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

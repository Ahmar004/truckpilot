// Checks that root vercel.json allows the inline theme script by its sha256 (architecture 11).
// The hash covers the exact text between <script> and </script> in the built page, so it changes
// when frontend/index.html's inline script changes (even whitespace; Prettier can reformat it).
// To fix after an edit: run `npm run build && npm run check:csp`, then put the printed hash in the
// script-src of vercel.json's Content-Security-Policy.
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const html = await readFile(resolve(root, 'dist', 'app.html'), 'utf8')
const match = html.match(/<script>([\s\S]*?)<\/script>/)
if (!match) throw new Error('No inline script in dist/app.html')
const hash = `sha256-${createHash('sha256').update(match[1]).digest('base64')}`
const config = await readFile(resolve(root, '..', 'vercel.json'), 'utf8')
if (!config.includes(`'${hash}'`)) {
  console.error(
    `vercel.json CSP does not allow the inline theme script. Use '${hash}' in script-src.`,
  )
  process.exit(1)
}
console.log(`ok   inline theme script hash ${hash} is in vercel.json`)

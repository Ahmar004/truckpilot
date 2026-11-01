// Writes the prerendered HTML files after `vite build` and `vite build --ssr` (architecture 12.2).
// dist/index.html is the template Vite wrote; it is kept untouched as dist/app.html (the CSR shell
// that Vercel serves for /plan), then /, /sign-in and /privacy are rendered into it.
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = resolve(root, 'dist')
const { render } = await import(pathToFileURL(resolve(root, 'dist-ssr', 'entry-prerender.js')).href)

const template = await readFile(resolve(dist, 'index.html'), 'utf8')
const marker = '<div id="root"></div>'
if (!template.includes(marker)) throw new Error('Template has no empty #root element')

await copyFile(resolve(dist, 'index.html'), resolve(dist, 'app.html'))
// Vercel Services ignores a rewrite `path`, so /plan is a plain file: dist/plan/index.html (CSR shell).
await mkdir(resolve(dist, 'plan'), { recursive: true })
await copyFile(resolve(dist, 'app.html'), resolve(dist, 'plan', 'index.html'))

const pages = [
  { url: '/', file: 'index.html' },
  { url: '/sign-in', file: 'sign-in/index.html' },
  { url: '/privacy', file: 'privacy/index.html' },
]
for (const page of pages) {
  const html = template.replace(marker, () => `<div id="root">${render(page.url)}</div>`)
  const target = resolve(dist, page.file)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, html)
  console.log(`prerendered ${page.url} -> dist/${page.file}`)
}

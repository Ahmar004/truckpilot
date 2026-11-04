// Fails when a built chunk is over its gzip budget (architecture 12.2). Run after `npm run build`.
// Chunks are found from the built HTML (entry set) and by file name (lazy pages) in dist/assets.
// A chunk's size counts the chunk plus the shared files it imports statically, minus files the
// entry set already holds. KB = bytes / 1024.
import { readdir, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const dist = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const assets = resolve(dist, 'assets')

const BUDGET_KB = { landing: 150, entry: 150, planner: 350, css: 40 }

const gzipKb = async (path) => gzipSync(await readFile(path)).length / 1024
const files = await readdir(assets)
const find = (prefix, ext) => {
  const hit = files.filter((f) => f.startsWith(`${prefix}-`) && f.endsWith(ext))
  if (hit.length !== 1)
    throw new Error(`Expected one ${prefix}-*${ext} in dist/assets, found ${hit.length}`)
  return hit[0]
}

/** Files a JS file imports statically (import"./x.js" or from"./x.js"); dynamic import() excluded. */
async function staticImports(file) {
  const source = await readFile(resolve(assets, file), 'utf8')
  const found = new Set()
  for (const match of source.matchAll(/(?:from|import)\s*["']\.\/([^"']+\.js)["']/g))
    found.add(match[1])
  return found
}

async function closure(roots) {
  const seen = new Set()
  const queue = [...roots]
  while (queue.length > 0) {
    const file = queue.pop()
    if (seen.has(file)) continue
    seen.add(file)
    for (const next of await staticImports(file)) queue.push(next)
  }
  return seen
}

async function sizeOf(set) {
  let total = 0
  for (const file of set) total += await gzipKb(resolve(assets, file))
  return total
}

// Entry set: what dist/index.html (the planner shell at /, Step-14) loads (entry script and preloads), plus their static imports.
const html = await readFile(resolve(dist, 'index.html'), 'utf8')
const entryRoots = [...html.matchAll(/(?:src|href)="\/assets\/([^"]+\.js)"/g)].map((m) => m[1])
const entry = await closure(entryRoots)

const landing = await closure([find('Landing', '.js')])
const planner = await closure([find('Planner', '.js'), find('PlannerMap', '.js')])
for (const file of entry) {
  landing.delete(file)
  planner.delete(file)
}
// The landing chunk is measured on its own (budget: alone), so shared files are not added to it.
const landingAlone = new Set([find('Landing', '.js')])

let cssTotal = 0
for (const file of files.filter((f) => f.endsWith('.css')))
  cssTotal += await gzipKb(resolve(assets, file))

const rows = [
  ['Landing chunk', await sizeOf(landingAlone), BUDGET_KB.landing],
  ['Main entry set', await sizeOf(entry), BUDGET_KB.entry],
  ['Planner chunk (with MapLibre)', await sizeOf(planner), BUDGET_KB.planner],
  ['CSS (all files)', cssTotal, BUDGET_KB.css],
]
let failed = false
for (const [name, kb, budget] of rows) {
  const over = kb > budget
  failed ||= over
  console.log(`${over ? 'OVER ' : 'ok   '} ${name}: ${kb.toFixed(1)} KB gzip (budget ${budget})`)
}
if (failed) {
  console.error('Size check failed: a chunk is over its gzip budget (architecture 12.2).')
  process.exit(1)
}

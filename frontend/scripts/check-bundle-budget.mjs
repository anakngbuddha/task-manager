#!/usr/bin/env node
/**
 * Post-build bundle budget check.
 *
 * Zero dependencies (node:fs, node:zlib, node:path only) so it can run in CI
 * without adding anything to package.json.
 *
 * Run after `vite build`, from the frontend directory:
 *
 *   node scripts/check-bundle-budget.mjs
 *
 * WHAT THIS IS ACTUALLY FOR
 * -------------------------
 * The important assertion is the chunk COUNT, not the sizes. Route components
 * in src/App.tsx are lazily imported; if someone converts a `React.lazy` back
 * to a static import, the emitted chunk count collapses and this check fails.
 * That is the regression test for the code-splitting work.
 *
 * The size budgets are deliberately generous on first landing, because no
 * trustworthy baseline exists yet. Read the printed table from a real CI run,
 * then tighten the numbers via the environment variables below.
 *
 * Overrides:
 *   BUDGET_MIN_CHUNKS      minimum number of emitted JS chunks   (default 10)
 *   BUDGET_ENTRY_GZIP_KB   gzip budget for the entry chunk       (default 250)
 *   BUDGET_MAX_CHUNK_KB    raw budget for any single chunk       (default 1200)
 *   BUDGET_TOTAL_KB        raw budget for all JS combined        (default 8192)
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join, resolve, relative } from 'node:path'

const DIST = resolve(process.cwd(), 'dist')
const INDEX_HTML = join(DIST, 'index.html')

function budget(envName, fallback) {
  const raw = process.env[envName]
  if (raw === undefined || raw === '') return fallback
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.error(`Invalid ${envName}="${raw}" (expected a positive number). Using default ${fallback}.`)
    return fallback
  }
  return parsed
}

const BUDGETS = {
  minChunks: budget('BUDGET_MIN_CHUNKS', 10),
  entryGzipKb: budget('BUDGET_ENTRY_GZIP_KB', 250),
  maxChunkKb: budget('BUDGET_MAX_CHUNK_KB', 1200),
  totalKb: budget('BUDGET_TOTAL_KB', 8192),
}

const KB = 1024
const kb = (bytes) => bytes / KB
const fmt = (bytes) => `${kb(bytes).toFixed(1)} kB`

/** Recursively collect every .js file under a directory. */
function collectJs(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      collectJs(full, out)
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      out.push(full)
    }
  }
  return out
}

/**
 * Identify the real entry chunk by reading index.html rather than guessing that
 * it is the largest file. Guessing breaks the moment a vendor chunk outgrows
 * the entry.
 */
function findEntryChunk() {
  if (!existsSync(INDEX_HTML)) return null
  const html = readFileSync(INDEX_HTML, 'utf8')
  const pattern = /<script[^>]*\bsrc=["']([^"']+\.js)["'][^>]*>/g
  for (const match of html.matchAll(pattern)) {
    const src = match[1]
    if (/^https?:\/\//i.test(src)) continue // externally hosted, not ours
    const candidate = join(DIST, src.replace(/^\/+/, ''))
    if (existsSync(candidate)) return candidate
  }
  return null
}

const failures = []
const warnings = []

// ─── 1. The build must actually exist ───────────────────────────────────
if (!existsSync(DIST)) {
  console.error(`FAIL  No dist/ directory at ${DIST}. Run \`vite build\` first.`)
  process.exit(1)
}
if (!existsSync(INDEX_HTML)) {
  console.error('FAIL  dist/index.html is missing. The build did not complete.')
  process.exit(1)
}

const jsFiles = collectJs(DIST)
if (jsFiles.length === 0) {
  console.error('FAIL  No JavaScript emitted into dist/. The build produced nothing.')
  process.exit(1)
}

// Service-worker output from vite-plugin-pwa is generated, not application
// code, so it is excluded from the chunk count and the entry budget.
const isServiceWorker = (file) => /(^|\/)(sw|registerSW|workbox-[^/]*)\.js$/.test(file.replace(/\\/g, '/'))

const appChunks = jsFiles.filter((f) => !isServiceWorker(f))
const entry = findEntryChunk()

const rows = appChunks
  .map((file) => {
    const source = readFileSync(file)
    return {
      name: relative(DIST, file).replace(/\\/g, '/'),
      raw: statSync(file).size,
      gzip: gzipSync(source).length,
      isEntry: entry !== null && file === entry,
    }
  })
  .sort((a, b) => b.raw - a.raw)

const totalRaw = rows.reduce((sum, r) => sum + r.raw, 0)
const totalGzip = rows.reduce((sum, r) => sum + r.gzip, 0)

// ─── Report ──────────────────────────────────────────────────────
console.log('\nBundle report')
console.log('='.repeat(74))
console.log(`${'chunk'.padEnd(46)}${'raw'.padStart(12)}${'gzip'.padStart(12)}`)
console.log('-'.repeat(74))
for (const row of rows.slice(0, 25)) {
  const label = `${row.isEntry ? '* ' : '  '}${row.name}`
  console.log(`${label.slice(0, 46).padEnd(46)}${fmt(row.raw).padStart(12)}${fmt(row.gzip).padStart(12)}`)
}
if (rows.length > 25) console.log(`  ... and ${rows.length - 25} more chunks`)
console.log('-'.repeat(74))
console.log(`${`TOTAL (${rows.length} chunks)`.padEnd(46)}${fmt(totalRaw).padStart(12)}${fmt(totalGzip).padStart(12)}`)
console.log('(* = entry chunk)\n')

// ─── 2. Code splitting must be in effect ───────────────────────────────
// This is the real regression test. Reverting a React.lazy() in src/App.tsx to
// a static import collapses the chunk count and trips this.
if (rows.length < BUDGETS.minChunks) {
  failures.push(
    `Only ${rows.length} JS chunks emitted, expected at least ${BUDGETS.minChunks}. ` +
      'Route-level code splitting has regressed: check that src/App.tsx still uses React.lazy() ' +
      'for its route components and that vite.config.ts still defines manualChunks.',
  )
}

// ─── 3. Entry chunk budget ──────────────────────────────────────────
if (entry === null) {
  warnings.push('Could not identify the entry chunk from dist/index.html; skipped the entry budget.')
} else {
  const entryRow = rows.find((r) => r.isEntry)
  if (entryRow && kb(entryRow.gzip) > BUDGETS.entryGzipKb) {
    failures.push(
      `Entry chunk ${entryRow.name} is ${fmt(entryRow.gzip)} gzipped, over the ${BUDGETS.entryGzipKb} kB budget.`,
    )
  }
}

// ─── 4. No single oversized chunk ─────────────────────────────────────
for (const row of rows) {
  if (kb(row.raw) > BUDGETS.maxChunkKb) {
    failures.push(`Chunk ${row.name} is ${fmt(row.raw)}, over the ${BUDGETS.maxChunkKb} kB per-chunk budget.`)
  }
}

// ─── 5. Total budget ──────────────────────────────────────────────
if (kb(totalRaw) > BUDGETS.totalKb) {
  failures.push(`Total JS is ${fmt(totalRaw)}, over the ${BUDGETS.totalKb} kB budget.`)
}

// ─── Verdict ────────────────────────────────────────────────────
for (const warning of warnings) console.warn(`WARN  ${warning}`)

if (failures.length > 0) {
  console.error(`\n${failures.length} budget check(s) failed:\n`)
  for (const failure of failures) console.error(`  FAIL  ${failure}`)
  console.error('')
  process.exit(1)
}

console.log(
  `PASS  ${rows.length} chunks, ${fmt(totalRaw)} raw / ${fmt(totalGzip)} gzip, all budgets satisfied.\n`,
)

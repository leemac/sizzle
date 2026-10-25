// Reports which ingredient lines get an icon. Input is a Sizzle cookbook export (cookbook.json; its
// ingredient item names are read as data) or a text file with one ingredient per line. Run from the repo root.
//
//   node --experimental-strip-types .claude/skills/sizzle-ingredient-icons/scripts/coverage.mjs path/to/cookbook.json [--all]
//
// Prints the lines with no icon, then every match grouped by icon with --all, then the total.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const { ingredientIcon } = await import(pathToFileURL(resolve('app/frontend/lib/ingredientIcons.ts')).href)
const [path, flag] = process.argv.slice(2)
if (!path) {
  console.error('Usage: coverage.mjs <cookbook.json | lines.txt> [--all]')
  process.exit(1)
}

const text = readFileSync(path, 'utf8')
const items = path.endsWith('.json')
  ? JSON.parse(text)
      .recipes.flatMap((recipe) => recipe.ingredients ?? [])
      .map((ingredient) => ingredient?.item)
      .filter((item) => typeof item === 'string' && item.trim())
  : text.split('\n').filter((line) => line.trim())

const matched = new Map()
const misses = []
for (const item of items) {
  const icon = ingredientIcon(item)
  if (!icon) misses.push(item)
  else matched.set(icon, [...(matched.get(icon) ?? []), item])
}

console.log(
  misses.length
    ? `No icon (${misses.length}):\n${misses.map((item) => `  ${item}`).join('\n')}`
    : 'Every line has an icon.',
)
if (flag === '--all') {
  for (const [icon, lines] of [...matched].sort(([a], [b]) => a.localeCompare(b))) {
    console.log(`\n${icon}\n${[...new Set(lines)].map((item) => `  ${item}`).join('\n')}`)
  }
}
const hits = items.length - misses.length
console.log(
  `\n${hits} of ${items.length} lines have an icon (${items.length ? Math.round((hits / items.length) * 100) : 0}%).`,
)

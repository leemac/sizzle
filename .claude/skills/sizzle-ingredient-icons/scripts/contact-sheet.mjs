// Renders ingredient icons as a contact sheet at 72, 20 and 16px, so drawings can be judged at the
// sizes the app uses. Reads app/frontend/lib/ingredientIcons.ts directly; run from the repo root.
//
//   node --experimental-strip-types .claude/skills/sizzle-ingredient-icons/scripts/contact-sheet.mjs [out.svg] [icon ...]
//   rsvg-convert tmp/ingredient-icons.svg -o tmp/ingredient-icons.png
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const { INGREDIENT_ICONS } = await import(pathToFileURL(resolve('app/frontend/lib/ingredientIcons.ts')).href)
const [out = 'tmp/ingredient-icons.svg', ...ids] = process.argv.slice(2)
const names = ids.length ? ids : Object.keys(INGREDIENT_ICONS)
const unknown = names.filter((name) => !INGREDIENT_ICONS[name])
if (unknown.length) {
  console.error(`Unknown icons: ${unknown.join(', ')}`)
  process.exit(1)
}

const columns = Math.min(8, names.length)
const cell = 120
const rows = Math.ceil(names.length / columns)
const icon = (d, size, x, y) =>
  `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#18181b" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`

let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${columns * cell}" height="${rows * cell}"><rect width="100%" height="100%" fill="#fff"/>`
names.forEach((name, index) => {
  const x = (index % columns) * cell
  const y = Math.floor(index / columns) * cell
  const { d, group } = INGREDIENT_ICONS[name]
  svg += `<rect x="${x + 20}" y="${y + 6}" width="72" height="72" fill="none" stroke="#eee"/>`
  // The 2–22 keyline square, faint, so overreach is easy to spot.
  svg += `<rect x="${x + 26}" y="${y + 12}" width="60" height="60" fill="none" stroke="#f3dada"/>`
  svg += icon(d, 72, x + 20, y + 6) + icon(d, 20, x + 96, y + 10) + icon(d, 16, x + 98, y + 36)
  svg += `<text x="${x + 6}" y="${y + 98}" font-size="11" font-family="Helvetica">${name}</text>`
  svg += `<text x="${x + 6}" y="${y + 111}" font-size="9" fill="#888" font-family="Helvetica">${group}</text>`
})
writeFileSync(out, `${svg}</svg>`)
console.log(`Wrote ${out} with ${names.length} icons. To view: rsvg-convert ${out} -o ${out.replace(/\.svg$/, '.png')}`)

#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

const site = new URL('../site/', import.meta.url)
const page = new URL('index.html', site)
const html = readFileSync(page, 'utf8')
const updated = html.replace(/((?:href|src)=")(\/[^"?]+\.(?:css|js))(?:\?[^" ]*)?(")/g, (_, start, path, end) => {
  const hash = createHash('sha256')
    .update(readFileSync(new URL(path.slice(1), site)))
    .digest('hex')
    .slice(0, 12)
  return `${start}${path}?v=${hash}${end}`
})
writeFileSync(page, updated)
console.log('Updated marketing CSS and JavaScript content hashes.')

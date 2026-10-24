import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const assetPath = (p) => new URL(`assets/default/${p}`, root)
// Lê largura/altura do IHDR (bytes 16-23 de um PNG).
const pngSize = (file) => {
  const b = readFileSync(file)
  assert.deepEqual([...b.subarray(1, 4)], [0x50, 0x4e, 0x47], `${file} não é PNG`)
  return [b.readUInt32BE(16), b.readUInt32BE(20)]
}

test('todo src de imagem usado em page/ existe em assets/default/', () => {
  const pages = readdirSync(new URL('page/', root)).filter((f) => f.endsWith('.js'))
  const srcs = new Set()
  for (const f of pages) {
    const code = readFileSync(new URL(`page/${f}`, root), 'utf8')
    for (const [, s] of code.matchAll(/'((?:icons\/)?[\w.-]+\.png)'/g)) srcs.add(s)
  }
  assert.ok(srcs.size >= 8, 'poucos srcs encontrados: a regex quebrou?')
  for (const s of srcs) assert.ok(existsSync(assetPath(s)), `faltando assets/default/${s}`)
})

test('icon.png tem 248x248 (tamanho do ícone de app para 480 px na documentação Zepp)', () => {
  assert.deepEqual(pngSize(assetPath('icon.png').pathname), [248, 248])
})

test('logo.png tem 120x120 e os ícones de cartão são 40x40', () => {
  assert.deepEqual(pngSize(assetPath('logo.png').pathname), [120, 120])
  const icons = readdirSync(assetPath('icons/').pathname).filter((f) => f.endsWith('.png'))
  assert.ok(icons.length >= 7)
  for (const f of icons) assert.deepEqual(pngSize(assetPath(`icons/${f}`).pathname), [40, 40], f)
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'

const walk = (d) => readdirSync(d).flatMap((f) => (statSync(`${d}/${f}`).isDirectory() ? walk(`${d}/${f}`) : [`${d}/${f}`]))
// Chaves são literais 'ns.chave'; pega também as escolhidas por ternário (t(x ? 'a.b' : 'a.c')).
const keysIn = (dirs) => new Set(dirs.flatMap((d) => { try { return walk(d) } catch { return [] } })
  .filter((f) => f.endsWith('.js')).map((f) => readFileSync(f, 'utf8')).filter((src) => src.includes('@zos/i18n'))
  .flatMap((src) => [...src.matchAll(/['"]([a-z]+\.[A-Za-z]+)['"]/g)].map((m) => m[1])))

const po = (l) => [...readFileSync(`page/i18n/${l}.po`, 'utf8').matchAll(/^msgid "(.+)"$/gm)].map((m) => m[1])

for (const l of ['pt-BR', 'en-US']) {
  test(`${l} tem toda chave usada no código, sem duplicatas`, () => {
    const have = po(l)
    assert.equal(new Set(have).size, have.length)
    const used = keysIn(['page', 'app-service', 'utils', 'app-side'])
    assert.deepEqual([...used].filter((k) => !have.includes(k)), [])
  })
}

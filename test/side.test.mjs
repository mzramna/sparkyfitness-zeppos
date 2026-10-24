import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reset, load } from './helpers.mjs'
import { routes } from './fixtures/full-routes.mjs'

const S = { server: 'https://sf.test', apiKey: 'K' }
const e = (id, type, data) => ({ id, type, data, ts: '2026-10-24T12:00:00.000Z', date: '2026-10-24', time: '09:00' })
const run = async (Z, method, params) => {
  await load('app-side/index.js')
  let out
  await Z.side.onRequest({ method, params }, (err, r) => { out = r })
  return out
}
// fetchToday usa a data real do aparelho: mapeia as rotas datadas para hoje.
const today = () => new Date().toLocaleDateString('sv')
const withToday = () => Object.fromEntries(Object.entries(routes()).map(([k, v]) =>
  [k.replace(/2026-10-24/g, today()).replace('toDate=2026-10-25', `toDate=${new Date(Date.now() + 864e5).toLocaleDateString('sv')}`), v]))

test('sync ok: envia na ordem e devolve synced + today', async () => {
  const Z = reset({ settings: S, routes: { ...withToday(), '/api/mood': {}, '/api/v2/measurements/water-intake': {} } })
  const r = await run(Z, 'sync', { entries: [e('1', 'mood', { mood_value: 3 }), e('2', 'water', { container_id: 3, change: 1 })] })
  assert.deepEqual(r.synced, ['1', '2'])
  assert.equal(r.error, undefined)
  assert.equal(r.today.water.ml, 750)
  assert.deepEqual(Z.fetched.slice(0, 2).map((f) => f.url), ['https://sf.test/api/mood', 'https://sf.test/api/v2/measurements/water-intake'])
})

test('falha no meio: para no primeiro erro, sem ler o resto', async () => {
  const Z = reset({ settings: S, routes: { '/api/mood': {}, '/api/v2/measurements/water-intake': { status: 500, body: '' } } })
  const r = await run(Z, 'sync', { entries: [e('1', 'mood', { mood_value: 3 }), e('2', 'water', { container_id: 3, change: 1 }), e('3', 'mood', { mood_value: 1 })] })
  assert.deepEqual(r.synced, ['1'])
  assert.match(r.error, /HTTP 500/)
  assert.equal(r.today, undefined)
  assert.equal(Z.fetched.length, 2)
})

test('sem entradas só atualiza o dia; falha na leitura mantém synced', async () => {
  let Z = reset({ settings: S, routes: withToday() })
  let r = await run(Z, 'sync', {})
  assert.deepEqual(r.synced, [])
  assert.ok(r.today)
  Z = reset({ settings: S, routes: { '/api/mood': {} } })
  r = await run(Z, 'sync', { entries: [e('1', 'mood', { mood_value: 3 })] })
  assert.deepEqual(r.synced, ['1'])
  assert.match(r.error, /HTTP 404/)
})

test('método inválido e credencial ausente', async () => {
  let Z = reset({ settings: S })
  assert.deepEqual(await run(Z, 'outro'), { error: 'método inválido' })
  Z = reset({ settings: {} })
  const r = await run(Z, 'sync', { entries: [e('1', 'mood', { mood_value: 3 })] })
  assert.deepEqual(r.synced, [])
  assert.match(r.error, /configure servidor/)
})

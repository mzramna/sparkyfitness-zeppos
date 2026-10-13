// Testa o mapeamento registro → requisição em app-side/api.js com fetch simulado.
// Roda com: npm test (gera bundle com esbuild trocando @zeppos/zml/base-side por um stub).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'

const { outputFiles } = await build({ entryPoints: ['app-side/api.js'], bundle: true, format: 'esm', write: false,
  plugins: [{ name: 'stub', setup(b) {
    b.onResolve({ filter: /^@zeppos\/zml\/base-side$/ }, () => ({ path: 'stub', namespace: 'stub' }))
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents:
      'export const settingsLib = { getItem: (k) => ({ server: "https://sf.test/", apiKey: "K" })[k] }' }))
  } }] })
const api = await import('data:text/javascript,' + encodeURIComponent(outputFiles[0].text))

const calls = []
globalThis.fetch = async (req) => { calls.push(req); return { status: 200, body: JSON.stringify(routes[req.url.replace('https://sf.test', '')] ?? {}) } }
const routes = {
  '/api/water-containers': [{ id: 3, name: 'Copo', volume: 250, unit: 'ml', is_primary: true }],
  '/api/v2/medications?activeOnly=true': [{ id: 'm1', name: 'Dipirona', dose_amount: 500, dose_unit: 'mg' }],
  '/api/meal-types': [{ id: 'b', name: 'Breakfast', is_visible: true }, { id: 'x', name: 'Oculta', is_visible: false }],
  '/api/foods': { recentFoods: [{ id: 'f1', name: 'Arroz', default_variant: { id: 'v1', serving_size: 100, serving_unit: 'g' } }],
    topFoods: [{ id: 'f1', name: 'Arroz', default_variant: { id: 'v1', serving_size: 100, serving_unit: 'g' } }] }
}
const entry = (type, data) => ({ id: '1', type, data, ts: '2026-10-13T12:00:00.000Z', date: '2026-10-13', time: '09:00' })

test('catálogo vem da instância, sem duplicatas e sem refeições ocultas', async () => {
  const c = await api.fetchCatalog()
  assert.deepEqual(c.containers, [{ id: 3, name: 'Copo', volume: 250, unit: 'ml' }])
  assert.equal(c.medications[0].name, 'Dipirona')
  assert.deepEqual(c.mealTypes, [{ id: 'b', name: 'Breakfast' }])
  assert.deepEqual(c.foods, [{ food_id: 'f1', name: 'Arroz', variant_id: 'v1', quantity: 100, unit: 'g' }])
  assert.equal(calls[0].headers.Authorization, 'Bearer K')
})

test('cada tipo vai para o endpoint correto', async () => {
  calls.length = 0
  await api.sendEntry(entry('water', { container_id: 3 }))
  await api.sendEntry(entry('meds', { medication_id: 'm1', dose_amount: 500, dose_unit: 'mg' }))
  await api.sendEntry(entry('cycle', { flow_level: 'light' }))
  await api.sendEntry(entry('food', { food_id: 'f1', name: 'Arroz', variant_id: 'v1', quantity: 100, unit: 'g', meal_type_id: 'b' }))
  const got = calls.map((c) => [c.method, c.url, JSON.parse(c.body)])
  assert.deepEqual(got[0], ['POST', 'https://sf.test/api/v2/measurements/water-intake', { entry_date: '2026-10-13', change_drinks: 1, container_id: 3 }])
  assert.equal(got[1][1], 'https://sf.test/api/v2/medications/entries')
  assert.equal(got[1][2].status, 'prn_taken')
  assert.deepEqual(got[2], ['PUT', 'https://sf.test/api/v2/cycle/logs/2026-10-13', { flow_level: 'light' }])
  assert.deepEqual(got[3][2], { food_id: 'f1', variant_id: 'v1', quantity: 100, unit: 'g', meal_type_id: 'b', entry_date: '2026-10-13', entry_time: '09:00' })
})

test('erro HTTP interrompe o envio', async () => {
  globalThis.fetch = async () => ({ status: 401, body: '' })
  await assert.rejects(api.sendEntry(entry('water', { container_id: 3 })), /HTTP 401/)
})

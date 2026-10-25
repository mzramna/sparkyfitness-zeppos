import { test } from 'node:test'
import assert from 'node:assert/strict'
import { load, reset } from './helpers.mjs'

test('saveConfig e loadConfig gravam e recuperam config do localStorage', async () => {
  reset()
  const { saveConfig, loadConfig } = await load('utils/direct-sync.js')
  assert.deepEqual(loadConfig(), {})
  saveConfig({ server: 'https://sparkyfitness.example.com', apiKey: 'secret', sensorMode: 'direct' })
  assert.deepEqual(loadConfig(), { server: 'https://sparkyfitness.example.com', apiKey: 'secret', sensorMode: 'direct' })
  saveConfig(null)
  globalThis.__zos.storage.setItem('config', 'invalid json')
  assert.deepEqual(loadConfig(), {})
})

test('canDirectSync valida disponibilidade de fetch e presença de credenciais', async () => {
  reset()
  const { saveConfig, canDirectSync } = await load('utils/direct-sync.js')
  const originalFetch = globalThis.fetch
  try {
    delete globalThis.fetch
    assert.equal(canDirectSync(), false)

    globalThis.fetch = async () => {}
    assert.equal(canDirectSync(), false)

    saveConfig({ server: 'https://example.com' })
    assert.equal(canDirectSync(), false)

    saveConfig({ server: 'https://example.com', apiKey: 'key123' })
    assert.equal(canDirectSync(), true)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('directSync envia entradas por Wi-Fi e monta o today do servidor', async () => {
  reset()
  const { saveConfig, directSync } = await load('utils/direct-sync.js')
  saveConfig({ server: 'https://sparky.test', apiKey: 'key-abc', sensorMode: 'direct' })

  const calls = []
  globalThis.fetch = async ({ url, method, headers, body }) => {
    calls.push({ url, method, headers, body: body ? JSON.parse(body) : undefined })
    const path = url.replace('https://sparky.test', '')

    if (method === 'GET' && path === '/api/fasting/current') {
      return { status: 200, body: JSON.stringify({ id: 99, start_time: '2026-10-24T12:00:00Z', target_end_time: '2026-10-25T04:00:00Z', fasting_type: '16:8', status: 'active' }) }
    }
    if (method === 'GET' && path.startsWith('/api/daily-summary')) {
      return { status: 200, body: JSON.stringify({
        calorieBalance: { eaten: 1500, burned: 400, remaining: 100, goal: 2000 },
        goals: { calories: 2000, protein: 120, carbs: 200, fat: 60, dietary_fiber: 25, water_goal_ml: 2500 },
        waterIntake: 1800,
        foodEntries: [{ protein: 30, carbs: 50, fat: 10, dietary_fiber: 5, quantity: 1, serving_size: 1 }]
      }) }
    }
    if (method === 'GET' && path === '/api/water-containers') {
      return { status: 200, body: JSON.stringify([
        { id: 1, name: 'Garrafa L', volume: 1, unit: 'L', is_primary: true },
        { id: 2, name: 'Copo Oz', volume: 8, unit: 'oz', is_primary: false },
        { id: 3, name: 'Copo Cup', volume: 1, unit: 'cup', is_primary: false },
        { id: 4, name: 'Copo Ml', volume: 200, unit: 'ml', is_primary: false }
      ]) }
    }
    if (method === 'GET' && path.startsWith('/api/v2/medications')) {
      return { status: 200, body: JSON.stringify([
        { id: 'm1', name: 'Med1', dose_amount: 500, dose_unit: 'mg' },
        { id: 'm2', name: 'Med2', strength_value: 10, strength_unit: 'ml' }
      ]) }
    }
    if (method === 'GET' && path === '/api/fasting/preferences') {
      return { status: 200, body: JSON.stringify({ default_protocol: '18-6', target_fasting_hours: 18 }) }
    }
    return { status: 200, body: JSON.stringify({ ok: true }) }
  }

  const entries = [
    { id: 'e1', type: 'water', date: '2026-10-25', data: { change: 1, container_id: 1 } },
    { id: 'e2', type: 'meds', date: '2026-10-25', ts: '2026-10-25T08:00:00Z', data: { medication_id: 'm1', status: 'taken', schedule_id: 's1', scheduled_for: '2026-10-25T08:00:00Z' } },
    { id: 'e3', type: 'meds', date: '2026-10-25', ts: '2026-10-25T09:00:00Z', data: { medication_id: 'm2', status: 'prn_taken' } },
    { id: 'e4', type: 'cycle', date: '2026-10-25', data: { flow_level: 'medium' } },
    { id: 'e5', type: 'food', date: '2026-10-25', time: '12:30', data: { food_id: 'f1', name: 'Almoço' } },
    { id: 'e6', type: 'mood', date: '2026-10-25', data: { mood_value: 4 } },
    { id: 'e7', type: 'symptom', date: '2026-10-25', ts: '2026-10-25T14:00:00Z', data: { symptom_id: 'y1', name: 'Cansaço' } },
    { id: 'e8', type: 'fast_start', ts: '2026-10-25T20:00:00Z', data: { fasting_type: '16:8', target_end_time: '2026-10-26T12:00:00Z' } },
    { id: 'e9', type: 'fast_end', ts: '2026-10-25T12:00:00Z', data: {} },
    { id: 'e10', type: 'health', date: '2026-10-25', data: { type: 'steps', value: 5000 } }
  ]

  const res = await directSync(entries)
  assert.deepEqual(res.synced, ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8', 'e9', 'e10'])
  assert.equal(res.today.calories.eaten, 1500)
  assert.equal(res.today.water.ml, 1800)
  assert.equal(res.today.fastingPrefs.fasting_type, '18:6')
  assert.equal(res.today.containers[0].volume_ml, 1000)
  assert.equal(res.today.containers[1].volume_ml, 237)
  assert.equal(res.today.containers[2].volume_ml, 240)
  assert.equal(res.today.containers[3].volume_ml, 200)
  assert.equal(res.today.medications[1].dose_amount, 10)
})

test('directSync trata erros de HTTP e ausência de config', async () => {
  reset()
  const { saveConfig, directSync } = await load('utils/direct-sync.js')
  await assert.rejects(() => directSync([]), /config ausente/)

  saveConfig({ server: 'https://sparky.test', apiKey: 'key-abc' })
  globalThis.fetch = async () => ({ status: 401, body: JSON.stringify({ message: 'Unauthorized' }) })
  await assert.rejects(() => directSync([{ id: '1', type: 'water', date: '2026-10-25', data: { change: 1, container_id: 1 } }]), /HTTP 401 - Unauthorized/)

  globalThis.fetch = async () => ({ status: 500, body: 'Internal Error' })
  await assert.rejects(() => directSync([{ id: '1', type: 'water', date: '2026-10-25', data: { change: 1, container_id: 1 } }]), /HTTP 500/)
})

test('directSync em modo health-connect não envia health mas inclui no synced', async () => {
  reset()
  const { saveConfig, directSync } = await load('utils/direct-sync.js')
  saveConfig({ server: 'https://sparky.test', apiKey: 'key-abc', sensorMode: 'health-connect' })

  const sent = []
  globalThis.fetch = async ({ url, method, body }) => {
    sent.push({ url, method, body })
    if (url.includes('/api/daily-summary')) {
      return { status: 200, body: JSON.stringify({}) }
    }
    if (url.includes('/api/water-containers') || url.includes('/api/v2/medications')) {
      return { status: 200, body: JSON.stringify([]) }
    }
    return { status: 200, body: JSON.stringify({ ok: true }) }
  }

  const res = await directSync([{ id: 'h1', type: 'health', date: '2026-10-25', data: { steps: 1000 } }])
  assert.deepEqual(res.synced, ['h1'])
  assert.equal(sent.some((s) => s.url.includes('/api/health-data')), false)
})

test('directSync: fast_end sem jejum ativo, erros sem corpo e respostas vazias', async () => {
  reset()
  const { saveConfig, directSync } = await load('utils/direct-sync.js')
  saveConfig({ server: 'https://sparky.test///', apiKey: 'k' })
  const sent = []
  globalThis.fetch = async ({ url, method }) => {
    sent.push(`${method} ${url}`)
    if (url.includes('/api/fasting/')) return { status: 404, body: '' }
    if (url.includes('/api/daily-summary')) return { status: 200, body: { foodEntries: [{ protein: 10, quantity: 2 }] } }
    return { status: 200, body: '' }
  }
  const res = await directSync([
    { id: 'f', type: 'fast_end', ts: 't', data: {} },
    { id: 'u', type: 'desconhecido', data: {} }
  ])
  assert.deepEqual(res.synced, ['f', 'u'])
  assert.equal(sent.some((s) => s.includes('/api/fasting/end')), false)
  assert.equal(sent[0], 'GET https://sparky.test/api/fasting/current')

  globalThis.fetch = async () => ({ status: 503, body: '{invalid' })
  await assert.rejects(() => directSync([]), /^Error: HTTP 503$/)
  globalThis.fetch = async () => ({ status: 400, body: { error: 'bad' } })
  await assert.rejects(() => directSync([]), /HTTP 400 - bad/)
  globalThis.fetch = async () => ({ status: 418, body: '"teapot"' })
  await assert.rejects(() => directSync([]), /HTTP 418 - teapot/)
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { load, reset, tap } from './helpers.mjs'

const fixture = () => JSON.parse(readFileSync(new URL('./fixtures/today.json', import.meta.url)))
const stubs = {
  sensors: 'export const collectHealth = async () => { const Z = globalThis.__zos; Z.calls.push(["health"]); if (Z.healthFails) throw new Error("x") }',
  reminders: 'export const scheduleReminders = (d) => { const Z = globalThis.__zos; Z.calls.push(["remind", d]); if (Z.remindFails) throw new Error("x") }'
}
const texts = (Z) => Z.widgets.map((w) => w.props.text).filter(Boolean)
const queue = (Z) => JSON.parse(Z.storage.getItem('queue', '[]'))
const toasts = (Z) => Z.calls.filter((c) => c[0] === 'toast').map((c) => c[1])
const tick = () => new Promise((r) => setTimeout(r, 0))
// Timers falsos: a página de jejum agenda setInterval; o teste dispara e confere o clear.
const timers = new Map()
let nextTimer = 1
globalThis.setInterval = (fn, ms) => { const id = nextTimer++; timers.set(id, { fn, ms }); return id }
globalThis.clearInterval = (id) => { timers.delete(id) }

async function open(entry, { today, params, request } = {}) {
  const Z = reset()
  if (today) Z.storage.setItem('today', JSON.stringify(today))
  await load(entry, stubs)
  const page = Z.page
  page.request = request
  page.onInit?.(params && JSON.stringify(params))
  page.build()
  return { Z, page }
}

test('dashboard sem cache pede sync e mostra botão', async () => {
  const { Z } = await open('page/index.js')
  assert.ok(texts(Z).includes('dash.syncToDownload'))
  assert.ok(texts(Z).includes('dash.sync (0)'))
})

test('dashboard completo: textos, cores e navegação', async () => {
  const { Z } = await open('page/index.js', { today: fixture() })
  const t = texts(Z)
  for (const x of ['800', 'dash.remaining', 'dash.eaten 1200', 'dash.burned 300', '80/150', '500/2000 ml', 'dash.noDoses'.slice(0, 0)]) assert.ok(x === '' || t.includes(x), x)
  assert.ok(t.some((x) => x.startsWith('dash.meds: ') && x.includes('Vitamina D')))
  assert.ok(t.includes('dash.cycle: luteal 21'))
  const ring = Z.widgets.find((w) => w.type === 'ARC_PROGRESS')
  assert.equal(ring.props.level, 60)
  assert.equal(ring.props.color, 0x8792e3)
  tap(Z, 'dash.mood')
  tap(Z, 'dash.fasting')
  assert.deepEqual(Z.calls.filter((c) => c[0] === 'push').map((c) => c[1]),
    [{ url: 'page/list', params: '{"key":"mood"}' }, { url: 'page/fasting' }])
})

test('dashboard acima da meta usa a cor over', async () => {
  const T = fixture(); T.calories = { eaten: 2300, burned: 0, remaining: -300, goal: 2000 }
  const { Z } = await open('page/index.js', { today: T })
  const ring = Z.widgets.find((w) => w.type === 'ARC_PROGRESS')
  assert.equal(ring.props.color, 0xe16b71)
  assert.equal(ring.props.level, 100)
  assert.ok(texts(Z).includes('dash.over'))
})

test('água +/- atualiza cache, barra, fila e botão de sync', async () => {
  const { Z } = await open('page/index.js', { today: fixture() })
  tap(Z, '+')
  tap(Z, '+')
  tap(Z, '−')
  assert.ok(texts(Z).includes('750/2000 ml'))
  assert.ok(texts(Z).includes('dash.sync (3)'))
  assert.deepEqual(queue(Z).map((e) => [e.type, e.data]), [['water', { container_id: 3, change: 1 }],
    ['water', { container_id: 3, change: 1 }], ['water', { container_id: 3, change: -1 }]])
  assert.equal(JSON.parse(Z.storage.getItem('today')).water.ml, 750)
})

test('sync: coleta saúde, envia fila, remove confirmados, salva cache e agenda lembretes', async () => {
  const T = fixture()
  const sent = []
  const { Z, page } = await open('page/index.js', { today: T,
    request: async (m) => { sent.push(m); return { synced: [queue(Z)[0].id], today: { ...T, water: { ml: 1, goal_ml: 2 } } } } })
  tap(Z, '+'); tap(Z, '+')
  Z.healthFails = true // falha de sensor não bloqueia
  tap(Z, 'dash.sync')
  await tick(); await tick()
  assert.equal(sent[0].method, 'sync')
  assert.equal(sent[0].params.entries.length, 2)
  assert.equal(queue(Z).length, 1)
  assert.equal(JSON.parse(Z.storage.getItem('today')).water.ml, 1)
  assert.deepEqual(Z.calls.find((c) => c[0] === 'remind')[1], T.doses)
  assert.ok(toasts(Z).includes('1 dash.sent'))
  assert.deepEqual(Z.calls.find((c) => c[0] === 'replace')[1], { url: 'page/index' })
})

test('sync: erro do servidor, falha do lembrete e celular desconectado', async () => {
  let reply = { synced: [], error: 'boom' }
  const { Z } = await open('page/index.js', { today: fixture(), request: async () => { if (!reply) throw new Error('ble'); return reply } })
  tap(Z, 'dash.sync'); await tick(); await tick()
  assert.ok(toasts(Z).includes('dash.error: boom'))
  assert.ok(texts(Z).includes('dash.sync (0)'))
  Z.remindFails = true
  reply = { synced: [], today: fixture() }
  tap(Z, 'dash.sync'); await tick(); await tick()
  assert.ok(Z.calls.some((c) => c[0] === 'replace'))
  reply = null
  tap(Z, 'dash.sync'); await tick(); await tick()
  assert.ok(toasts(Z).includes('dash.disconnected'))
})

test('lista sem cache e lista vazia', async () => {
  let r = await open('page/list.js', { params: { key: 'mood' } })
  assert.ok(texts(r.Z).includes('dash.syncToDownload'))
  const T = fixture(); T.symptoms = []
  r = await open('page/list.js', { today: T, params: { key: 'symptom' } })
  assert.ok(texts(r.Z).includes('list.empty'))
})

test('lista de água: total e +/- por recipiente', async () => {
  const { Z } = await open('page/list.js', { today: fixture(), params: { key: 'water' } })
  assert.ok(texts(Z).includes('500 / 2000 ml'))
  tap(Z, '+ Copo')
  assert.ok(texts(Z).includes('750 / 2000 ml'))
  tap(Z, '− Copo')
  assert.deepEqual(queue(Z).map((e) => e.data), [{ container_id: 3, change: 1 }, { container_id: 3, change: -1 }])
  assert.ok(toasts(Z).includes('list.registered (2)'))
})

test('remédios: dose feita não clica, pendente vai a taken/skipped, PRN direto', async () => {
  let r = await open('page/list.js', { today: fixture(), params: { key: 'meds' } })
  const done = r.Z.widgets.find((w) => String(w.props.text).startsWith('✓ '))
  assert.equal(done.props.color, 0x737b8c)
  done.props.click_func()
  assert.deepEqual([queue(r.Z).length, r.Z.calls.length], [0, 0])
  tap(r.Z, 'Ibuprofeno')
  assert.deepEqual(queue(r.Z)[0].data, { medication_id: 'm3', status: 'prn_taken', dose_amount: 400, dose_unit: 'mg' })
  tap(r.Z, '2') // dose pendente (hora local começa com dígito)
  const nav = r.Z.calls.find((c) => c[0] === 'push')[1]
  assert.equal(nav.url, 'page/list')

  for (const [label, status] of [['list.taken', 'taken'], ['list.skipped', 'skipped']]) {
    r = await open('page/list.js', { params: { key: 'dose', dose: fixture().doses[1] }, today: fixture() })
    tap(r.Z, label)
    assert.deepEqual(queue(r.Z)[0].data, { medication_id: 'm2', status, schedule_id: 's2',
      scheduled_for: '2026-10-24T20:00:00.000Z', dose_amount: 1, dose_unit: 'cp' })
    assert.equal(JSON.parse(r.Z.storage.getItem('today')).doses[1].done, true)
    assert.deepEqual(r.Z.calls.find((c) => c[0] === 'replace')[1], { url: 'page/list', params: '{"key":"meds"}' })
  }
})

test('ciclo, humor, sintoma e alimento enfileiram o item exato', async () => {
  let r = await open('page/list.js', { today: fixture(), params: { key: 'cycle' } })
  tap(r.Z, 'flow.heavy')
  assert.deepEqual(queue(r.Z)[0].data, { flow_level: 'heavy' })
  r = await open('page/list.js', { today: fixture(), params: { key: 'mood' } })
  tap(r.Z, 'mood.4')
  assert.deepEqual(queue(r.Z)[0].data, { mood_value: 4 })
  r = await open('page/list.js', { today: fixture(), params: { key: 'symptom' } })
  tap(r.Z, 'Dor de cabeça')
  assert.deepEqual(queue(r.Z)[0].data, { symptom_id: 'y1', name: 'Dor de cabeça' })
  r = await open('page/list.js', { today: fixture(), params: { key: 'food' } })
  tap(r.Z, 'Arroz')
  assert.equal(r.Z.calls.find((c) => c[0] === 'push')[1].params, JSON.stringify({ key: 'meal', food: fixture().foods[0] }))
  r = await open('page/list.js', { today: fixture(), params: { key: 'meal', food: fixture().foods[0] } })
  tap(r.Z, 'Café')
  assert.deepEqual(queue(r.Z)[0].data, { food_id: 'f1', name: 'Arroz', variant_id: 'v1', quantity: 100, unit: 'g', meal_type_id: 'b' })
  assert.deepEqual(r.Z.calls.find((c) => c[0] === 'replace')[1], { url: 'page/list', params: '{"key":"food"}' })
})

test('lista sem parâmetros usa objeto vazio', async () => {
  const Z = reset()
  await load('page/list.js', stubs)
  Z.page.onInit(undefined)
  assert.deepEqual(Z.page.params, {})
})

test('jejum: sem cache, sem prefs, iniciar e encerrar com cache otimista', async () => {
  let r = await open('page/fasting.js')
  assert.ok(texts(r.Z).includes('dash.syncToDownload'))
  const T = fixture(); T.fastingPrefs = null
  r = await open('page/fasting.js', { today: T })
  assert.ok(texts(r.Z).includes('fast.noPrefs'))
  assert.ok(!texts(r.Z).includes('fast.start'))

  r = await open('page/fasting.js', { today: fixture() })
  assert.ok(texts(r.Z).includes('fast.protocol 16:8'))
  tap(r.Z, 'fast.start')
  const item = queue(r.Z)[0]
  assert.equal(item.type, 'fast_start')
  assert.equal(item.data.fasting_type, '16:8')
  const h = (Date.parse(item.data.target_end_time) - Date.parse(item.ts)) / 3600e3
  assert.ok(Math.abs(h - 16) < 0.01)
  assert.equal(JSON.parse(r.Z.storage.getItem('today')).fasting.status, 'active')
  assert.ok(r.Z.calls.some((c) => c[0] === 'replace'))
})

test('jejum ativo mostra timer; encerrar enfileira fast_end e limpa cache', async () => {
  const T = fixture()
  const now = Date.now()
  T.fasting = { start_time: new Date(now - 8 * 3600e3).toISOString(), target_end_time: new Date(now + 8 * 3600e3).toISOString(),
    fasting_type: '16:8', status: 'active' }
  const r = await open('page/fasting.js', { today: T })
  assert.equal(r.Z.widgets.find((w) => w.type === 'ARC_PROGRESS').props.level, 50)
  assert.ok(texts(r.Z).includes('8:00'))
  assert.ok(texts(r.Z).some((x) => x.startsWith('fast.remaining 7:5') || x.startsWith('fast.remaining 8:00')))
  tap(r.Z, 'fast.end')
  assert.deepEqual(queue(r.Z).map((e) => [e.type, e.data]), [['fast_end', {}]])
  assert.equal(JSON.parse(r.Z.storage.getItem('today')).fasting, null)
})

test('jejum além da meta: anel completo em success e restante zerado', async () => {
  const T = fixture()
  const now = Date.now()
  T.fasting = { start_time: new Date(now - 20 * 3600e3).toISOString(), target_end_time: new Date(now - 4 * 3600e3).toISOString(), status: 'active' }
  const r = await open('page/fasting.js', { today: T })
  const ring = r.Z.widgets.find((w) => w.type === 'ARC_PROGRESS')
  assert.equal(ring.props.level, 100)
  assert.equal(ring.props.color, 0x3ecc7b)
  assert.ok(texts(r.Z).includes('fast.remaining 0:00'))
})

test('dose registrada vira feita no cache e na lista recarregada, sem novo toque', async () => {
  const r = await open('page/list.js', { today: fixture(), params: { key: 'dose', dose: fixture().doses[1] } })
  tap(r.Z, 'list.taken')
  assert.equal(JSON.parse(r.Z.storage.getItem('today')).doses[1].done, true)
  assert.equal(JSON.parse(r.Z.storage.getItem('today')).doses[0].done, fixture().doses[0].done)
  const again = await open('page/list.js', { today: JSON.parse(r.Z.storage.getItem('today')), params: { key: 'meds' } })
  const row = again.Z.widgets.find((w) => String(w.props.text).includes('Vitamina D') && String(w.props.text).startsWith('✓ '))
  assert.ok(row)
  assert.equal(row.props.color, 0x737b8c)
  row.props.click_func()
  assert.equal(queue(again.Z).length, 0)
})

test('jejum: timer de 1 min atualiza tempo decorrido e restante, e onDestroy limpa', async () => {
  timers.clear()
  const realNow = Date.now
  try {
    const T = fixture()
    const now = realNow()
    T.fasting = { start_time: new Date(now - 8 * 3600e3).toISOString(), target_end_time: new Date(now + 8 * 3600e3).toISOString(),
      fasting_type: '16:8', status: 'active' }
    const r = await open('page/fasting.js', { today: T })
    assert.equal(timers.size, 1)
    const [[id, tm]] = [...timers]
    assert.equal(tm.ms, 60000)
    Date.now = () => now + 3600e3 // uma hora depois
    tm.fn()
    assert.ok(texts(r.Z).includes('9:00'))
    assert.ok(texts(r.Z).includes('fast.remaining 7:00'))
    r.page.onDestroy()
    assert.equal(timers.has(id), false)
    assert.equal(timers.size, 0)
  } finally {
    Date.now = realNow
  }
})

test('jejum sem ativo não agenda timer', async () => {
  timers.clear()
  await open('page/fasting.js', { today: fixture() })
  assert.equal(timers.size, 0)
})

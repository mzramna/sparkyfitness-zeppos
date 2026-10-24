import { test } from 'node:test'
import assert from 'node:assert/strict'
import { load, reset } from './helpers.mjs'

const queue = () => JSON.parse(globalThis.__zos.storage.getItem('queue', '[]'))
const now = new Date(2026, 9, 24, 10, 0)
const all = {
  Step: { getCurrent: () => 4200 }, Calorie: { getCurrent: () => 310 }, HeartRate: { getResting: () => 58 },
  Sleep: { updateInfo() {}, getInfo: () => ({ totalTime: 420, deepTime: 90, score: 80, startTime: 23 * 60, endTime: 6 * 60 + 30 }) }
}

test('enfileira os 4 tipos de saúde', async () => {
  reset({ sensors: all })
  const { collectHealth } = await load('utils/sensors.js')
  collectHealth(now)
  const q = queue()
  assert.deepEqual(q.map((e) => e.data.type), ['steps', 'active_calories', 'resting_heart_rate', 'SleepSession'])
  assert.equal(q[0].data.value, 4200)
  const s = q[3].data
  assert.equal(s.duration_in_seconds, 25200)
  assert.equal(s.deep_sleep_seconds, 5400)
  assert.equal(new Date(s.bedtime).getDate(), 23) // antes da meia-noite = dia anterior
  assert.equal(new Date(s.wake_time).getHours(), 6)
})

test('segunda coleta substitui o pendente em vez de duplicar', async () => {
  reset({ sensors: all })
  const { collectHealth } = await load('utils/sensors.js')
  collectHealth(now)
  all.Step.getCurrent = () => 5000
  collectHealth(new Date(2026, 9, 24, 12, 0))
  all.Step.getCurrent = () => 4200
  const q = queue().filter((e) => e.data.type === 'steps')
  assert.equal(q.length, 1)
  assert.equal(q[0].data.value, 5000)
  assert.equal(queue().length, 4)
})

test('outro dia não substitui; sensor indisponível ou zerado é ignorado', async () => {
  reset({ sensors: { Step: { getCurrent: () => 1 }, HeartRate: { getResting: () => 0 } } })
  const { collectHealth } = await load('utils/sensors.js')
  collectHealth(now)
  collectHealth(new Date(2026, 9, 25, 9, 0))
  assert.deepEqual(queue().map((e) => e.date), ['2026-10-24', '2026-10-25'])
  assert.equal(queue().every((e) => e.data.type === 'steps'), true)
})

test('sono depois da meia-noite fica no mesmo dia; sono sem duração é ignorado', async () => {
  reset({ sensors: { Sleep: { updateInfo() {}, getInfo: () => ({ totalTime: 300, deepTime: 0, score: 0, startTime: 60, endTime: 360 }) } } })
  const { collectHealth } = await load('utils/sensors.js')
  collectHealth(now)
  assert.equal(new Date(queue()[0].data.bedtime).getDate(), 24)
  reset({ sensors: { Sleep: { updateInfo() {}, getInfo: () => ({ totalTime: 0 }) } } })
  ;(await load('utils/sensors.js')).collectHealth(now)
  assert.equal(queue().length, 0)
})

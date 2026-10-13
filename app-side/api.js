// Cliente da API SparkyFitness — os mesmos endpoints que o app Android oficial usa.
import { settingsLib } from '@zeppos/zml/base-side'

const SOURCE = 'zepp'

async function call(method, path, body) {
  const server = (settingsLib.getItem('server') || '').replace(/\/+$/, '')
  const key = settingsLib.getItem('apiKey') || ''
  if (!server || !key) throw new Error('configure servidor e API key no app Zepp')
  const res = await fetch({ url: server + path, method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: body ? JSON.stringify(body) : undefined })
  if (res.status < 200 || res.status >= 300) throw new Error(`${method} ${path}: HTTP ${res.status}`)
  return typeof res.body === 'string' && res.body ? JSON.parse(res.body) : res.body
}

// Catálogo da instância, reduzido ao que cabe no relógio.
export async function fetchCatalog() {
  const [containers, medications, mealTypes, foods, cycleSchema] = await Promise.all([
    call('GET', '/api/water-containers'),
    call('GET', '/api/v2/medications?activeOnly=true'),
    call('GET', '/api/meal-types'),
    call('GET', '/api/foods'),
    Promise.resolve(['none', 'spotting', 'light', 'medium', 'heavy']) // enum do schema do servidor (cycleSchemas.ts)
  ])
  const seen = new Set()
  const foodList = [...(foods.recentFoods || []), ...(foods.topFoods || [])]
    .filter((f) => f.default_variant && !seen.has(f.id) && seen.add(f.id))
    .map((f) => ({ food_id: f.id, name: f.name, variant_id: f.default_variant.id,
      quantity: f.default_variant.serving_size, unit: f.default_variant.serving_unit }))
  return {
    containers: (containers || []).map(({ id, name, volume, unit }) => ({ id, name, volume, unit })),
    medications: (medications || []).map(({ id, name, dose_amount, dose_unit }) => ({ id, name, dose_amount, dose_unit })),
    mealTypes: (mealTypes || []).filter((m) => m.is_visible !== false).map(({ id, name }) => ({ id, name })),
    foods: foodList,
    flowLevels: cycleSchema
  }
}

const SENDERS = {
  water: (e) => call('POST', '/api/v2/measurements/water-intake',
    { entry_date: e.date, change_drinks: 1, container_id: e.data.container_id }),
  meds: (e) => call('POST', '/api/v2/medications/entries', {
    medication_id: e.data.medication_id, status: 'prn_taken', taken_at: e.ts, entry_date: e.date,
    dose_amount_snapshot: e.data.dose_amount ?? null, dose_unit_snapshot: e.data.dose_unit ?? null, source: SOURCE }),
  cycle: (e) => call('PUT', `/api/v2/cycle/logs/${e.date}`, { flow_level: e.data.flow_level }),
  food: (e) => {
    const { name, ...d } = e.data
    return call('POST', '/api/food-entries/', { ...d, entry_date: e.date, entry_time: e.time })
  }
}

export const sendEntry = (e) => (SENDERS[e.type] ? SENDERS[e.type](e) : Promise.resolve())

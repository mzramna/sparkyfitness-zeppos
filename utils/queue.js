// Fila offline + cache do dia. Contrato compartilhado entre relógio e side service:
// item da fila: { id, type, data, ts (ISO), date (YYYY-MM-DD local), time (HH:MM local) }
// cache 'today': ver docs em CONTRACT.md
import { localStorage } from '@zos/storage'

const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k, '')); return v ?? d } catch (e) { return d } }
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v))
const pad = (n) => String(n).padStart(2, '0')

export const localDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const load = () => read('queue', [])
export const loadToday = () => read('today', null)
export const saveToday = (t) => write('today', t)

export function push(type, data, d = new Date()) {
  const q = load()
  q.push({ id: `${d.getTime()}-${q.length}`, type, data, ts: d.toISOString(), date: localDate(d),
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}` })
  write('queue', q)
  return q.length
}

export function remove(ids) { write('queue', load().filter((e) => !ids.includes(e.id))) }

// Atualiza o total de água do cache na hora, antes do sync confirmar.
export function addWater(container, change) {
  const t = loadToday()
  if (t && t.water) {
    t.water.ml = Math.max(0, t.water.ml + change * container.volume_ml)
    saveToday(t)
  }
  return push('water', { container_id: container.id, change })
}

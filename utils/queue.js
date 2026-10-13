// Fila offline: registros ficam no relógio até o servidor confirmar.
import { localStorage } from '@zos/storage'

const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k, '')) } catch (e) { return d } }
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v))
const pad = (n) => String(n).padStart(2, '0')

export const load = () => read('queue', []) || []
export const loadCatalog = () => read('catalog', null)
export const saveCatalog = (c) => write('catalog', c)

// Data/hora locais do relógio, no formato que a API espera.
export function push(type, data) {
  const d = new Date()
  const q = load()
  q.push({ id: `${d.getTime()}-${q.length}`, type, data, ts: d.toISOString(),
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}` })
  write('queue', q)
  return q.length
}

export function remove(ids) { write('queue', load().filter((e) => !ids.includes(e.id))) }

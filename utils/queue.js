// Fila offline: registros ficam no relógio até o sync confirmar.
import { localStorage } from '@zos/storage'
const KEY = 'queue'

export const load = () => { try { return JSON.parse(localStorage.getItem(KEY, '[]')) } catch (e) { return [] } }
const save = (q) => localStorage.setItem(KEY, JSON.stringify(q))

export function push(type, item) {
  const q = load()
  q.push({ id: `${Date.now()}-${q.length}`, type, value: item.value, unit: item.unit, label: item.label, ts: Date.now() })
  save(q)
  return q.length
}

export function remove(ids) { save(load().filter((e) => !ids.includes(e.id))) }

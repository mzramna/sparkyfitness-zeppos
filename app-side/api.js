// Único ponto de integração com o servidor SparkyFitness.
// Converte um registro da fila em uma requisição HTTP. Ajuste aqui se a API mudar.
const day = (ts) => new Date(ts).toISOString().slice(0, 10)

export function toRequest(e) {
  const date = day(e.ts)
  switch (e.type) {
    case 'water':
      return { path: '/api/health-data', body: [{ type: 'water', value: e.value, unit: e.unit, date, timestamp: new Date(e.ts).toISOString() }] }
    case 'meds':
      return { path: '/api/health-data', body: [{ type: 'medication', value: 1, name: e.value, date, timestamp: new Date(e.ts).toISOString() }] }
    case 'period':
      return { path: '/api/health-data', body: [{ type: 'menstruation', value: e.value, date, timestamp: new Date(e.ts).toISOString() }] }
    case 'food':
      return { path: '/api/health-data', body: [{ type: 'meal', meal_type: e.value, value: 1, date, timestamp: new Date(e.ts).toISOString() }] }
    default:
      return null
  }
}

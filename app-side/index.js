import { BaseSideService } from '@zeppos/zml/base-side'
import { settingsLib } from '@zeppos/zml/base-side'
import { toRequest } from './api'

async function send(e) {
  const server = (settingsLib.getItem('server') || '').replace(/\/+$/, '')
  const key = settingsLib.getItem('apiKey') || ''
  if (!server || !key) throw new Error('Configure servidor e API key no app Zepp')
  const req = toRequest(e)
  if (!req) return // tipo desconhecido: descarta
  const res = await fetch({ url: server + req.path, method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, 'x-api-key': key },
    body: JSON.stringify(req.body) })
  if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status}`)
}

AppSideService(BaseSideService({
  async onRequest(req, res) {
    if (req.method !== 'sync') return res(null, { ok: false, error: 'método inválido' })
    const synced = []
    for (const e of req.params.entries) {
      try { await send(e); synced.push(e.id) } catch (err) { return res(null, { ok: false, synced, error: err.message }) }
    }
    res(null, { ok: true, synced })
  }
}))

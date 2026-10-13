import { BaseSideService } from '@zeppos/zml/base-side'
import { fetchCatalog, sendEntry } from './api'

AppSideService(BaseSideService({
  async onRequest(req, res) {
    if (req.method !== 'sync') return res(null, { error: 'método inválido' })
    const synced = []
    try {
      for (const e of req.params.entries || []) { await sendEntry(e); synced.push(e.id) }
      res(null, { synced, catalog: await fetchCatalog() })
    } catch (err) {
      res(null, { synced, error: err.message })
    }
  }
}))

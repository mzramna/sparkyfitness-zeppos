import * as hmUI from '@zos/ui'
import { push as navigate } from '@zos/router'
import { showToast } from '@zos/interaction'
import { BasePage } from '@zeppos/zml/base-page'
import { load, remove, saveCatalog } from '../utils/queue'

const MENU = [['water', 'Água'], ['meds', 'Remédios'], ['cycle', 'Ciclo'], ['food', 'Alimentação']]

Page(BasePage({
  build() {
    let y = 60
    const btn = (text, click) => {
      const w = hmUI.createWidget(hmUI.widget.BUTTON, { x: 60, y, w: 360, h: 60, radius: 30, text, text_size: 26,
        normal_color: 0x1f6feb, press_color: 0x0d419d, click_func: click })
      y += 70
      return w
    }
    MENU.forEach(([key, title]) => btn(title, () => navigate({ url: 'page/list', params: JSON.stringify({ key }) })))
    this.syncBtn = btn(`Sincronizar (${load().length})`, () => this.sync())
  },
  // Envia a fila e, na mesma ida ao celular, atualiza o catálogo vindo da instância.
  sync() {
    showToast({ content: 'Sincronizando…' })
    this.request({ method: 'sync', params: { entries: load() } }, { timeout: 60000 })
      .then(({ synced = [], catalog, error }) => {
        remove(synced)
        if (catalog) saveCatalog(catalog)
        this.syncBtn.setProperty(hmUI.prop.TEXT, `Sincronizar (${load().length})`)
        showToast({ content: error ? `Erro: ${error}` : `${synced.length} enviados, dados atualizados` })
      })
      .catch(() => showToast({ content: 'Celular desconectado' }))
  }
}))

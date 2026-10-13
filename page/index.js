import * as hmUI from '@zos/ui'
import { push as navigate } from '@zos/router'
import { showToast } from '@zos/interaction'
import { BasePage } from '@zeppos/zml/base-page'
import { CATEGORIES } from '../utils/catalog'
import { load, remove } from '../utils/queue'

const W = 480, BTN_H = 64, GAP = 12

Page(BasePage({
  build() {
    let y = 70
    const btn = (text, click) => {
      hmUI.createWidget(hmUI.widget.BUTTON, { x: 60, y, w: W - 120, h: BTN_H, radius: 32, text, text_size: 28,
        normal_color: 0x1f6feb, press_color: 0x0d419d, click_func: click })
      y += BTN_H + GAP
    }
    Object.entries(CATEGORIES).forEach(([key, c]) => btn(c.title, () => navigate({ url: 'page/list', params: key })))
    btn(`Sincronizar (${load().length})`, () => this.sync())
  },
  sync() {
    const entries = load()
    if (!entries.length) return showToast({ content: 'Nada a sincronizar' })
    this.request({ method: 'sync', params: { entries } })
      .then(({ ok, synced, error }) => {
        if (synced && synced.length) remove(synced)
        showToast({ content: ok ? `${synced.length} enviados` : `Erro: ${error}` })
      })
      .catch(() => showToast({ content: 'Celular desconectado' }))
  }
}))

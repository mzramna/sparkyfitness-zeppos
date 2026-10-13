import * as hmUI from '@zos/ui'
import { showToast } from '@zos/interaction'
import { BasePage } from '@zeppos/zml/base-page'
import { CATEGORIES } from '../utils/catalog'
import { push } from '../utils/queue'

Page(BasePage({
  onInit(key) { this.key = key },
  build() {
    const cat = CATEGORIES[this.key]
    hmUI.createWidget(hmUI.widget.TEXT, { x: 0, y: 30, w: 480, h: 50, text: cat.title, text_size: 32,
      color: 0xffffff, align_h: hmUI.align.CENTER_H })
    cat.items.forEach((item, i) => {
      hmUI.createWidget(hmUI.widget.BUTTON, { x: 60, y: 100 + i * 76, w: 360, h: 64, radius: 32, text: item.label,
        text_size: 26, normal_color: 0x238636, press_color: 0x196c2e,
        click_func: () => showToast({ content: `Registrado (${push(this.key, item)} na fila)` }) })
    })
  }
}))

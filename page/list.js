import * as hmUI from '@zos/ui'
import { push as navigate, back } from '@zos/router'
import { showToast } from '@zos/interaction'
import { BasePage } from '@zeppos/zml/base-page'
import { loadCatalog, push } from '../utils/queue'

// Cada tela lista itens do catálogo da instância; nada é fixo no relógio.
const SCREENS = {
  water: { title: 'Água', items: (c) => c.containers, label: (i) => `${i.name} ${i.volume}${i.unit}`,
    pick: (i) => push('water', { container_id: i.id }) },
  meds: { title: 'Remédios', items: (c) => c.medications,
    label: (i) => (i.dose_amount ? `${i.name} ${i.dose_amount}${i.dose_unit || ''}` : i.name),
    pick: (i) => push('meds', { medication_id: i.id, dose_amount: i.dose_amount, dose_unit: i.dose_unit }) },
  cycle: { title: 'Fluxo', items: (c) => c.flowLevels.map((f) => ({ id: f, name: f })), label: (i) => i.name,
    pick: (i) => push('cycle', { flow_level: i.id }) },
  food: { title: 'Alimento', items: (c) => c.foods, label: (i) => i.name,
    pick: (i, self) => navigate({ url: 'page/list', params: JSON.stringify({ key: 'meal', food: i }) }) },
  meal: { title: 'Refeição', items: (c) => c.mealTypes, label: (i) => i.name,
    pick: (i, self) => push('food', { ...self.params.food, meal_type_id: i.id }) }
}

Page(BasePage({
  onInit(p) { this.params = JSON.parse(p || '{}') },
  build() {
    const s = SCREENS[this.params.key]
    const catalog = loadCatalog()
    hmUI.createWidget(hmUI.widget.TEXT, { x: 0, y: 30, w: 480, h: 50, text: s.title, text_size: 32,
      color: 0xffffff, align_h: hmUI.align.CENTER_H })
    const items = catalog ? s.items(catalog) || [] : []
    if (!items.length) {
      hmUI.createWidget(hmUI.widget.TEXT, { x: 40, y: 180, w: 400, h: 120, text_size: 24, color: 0xaaaaaa,
        align_h: hmUI.align.CENTER_H, text_style: hmUI.text_style.WRAP,
        text: catalog ? 'Nada cadastrado na sua instância' : 'Sincronize para baixar seus dados' })
      return
    }
    items.forEach((item, i) => {
      hmUI.createWidget(hmUI.widget.BUTTON, { x: 50, y: 100 + i * 72, w: 380, h: 62, radius: 31,
        text: s.label(item), text_size: 24, normal_color: 0x238636, press_color: 0x196c2e,
        click_func: () => {
          const n = s.pick(item, this)
          if (typeof n === 'number') { showToast({ content: `Registrado (${n} na fila)` }); if (this.params.key === 'meal') back() }
        } })
    })
  }
}))

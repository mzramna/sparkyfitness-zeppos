import * as hmUI from '@zos/ui'
import { push as navigate, replace } from '@zos/router'
import { showToast } from '@zos/interaction'
import { getText as t } from '@zos/i18n'
import { BasePage } from '@zeppos/zml/base-page'
import { load, remove, loadToday, saveToday, addWater } from '../utils/queue'
import { theme } from '../utils/theme'
import { collectHealth } from '../utils/sensors'
import { scheduleReminders } from '../utils/reminders'
import { hhmm } from '../utils/time'

const MACROS = ['protein', 'carbs', 'fat', 'fiber']

Page(BasePage({
  build() {
    const T = loadToday()
    // shortcut: VIEW_CONTAINER (API 3.6+) scroll não testado em hardware; trocar por y fixo se não rolar.
    const c = hmUI.createWidget(hmUI.widget.VIEW_CONTAINER, { x: 0, y: 0, w: 480, h: 480, scroll_enable: 1 })
    const text = (p) => c.createWidget(hmUI.widget.TEXT, { color: theme.text, text_size: 22, align_h: hmUI.align.CENTER_H, ...p })
    const btn = (y, label, color, click, p) => c.createWidget(hmUI.widget.BUTTON, { x: 50, y, w: 380, h: 64,
      radius: theme.radius, text: label, text_size: 24, color: theme.text, normal_color: color, press_color: theme.track,
      click_func: click, ...p })
    const bar = (y, pct, color, p) => {
      c.createWidget(hmUI.widget.FILL_RECT, { y, h: 10, radius: 5, color: theme.track, ...p })
      return c.createWidget(hmUI.widget.FILL_RECT, { y, h: 10, radius: 5, color, ...p, w: Math.round(p.w * Math.min(pct, 1)) })
    }
    const syncLabel = (n) => `${t('dash.sync')} (${n})`
    let y = 300

    if (T) {
      const { calories: cal, macros, water } = T
      const over = cal.remaining < 0
      c.createWidget(hmUI.widget.ARC, { x: 140, y: 40, w: 200, h: 200, start_angle: -90, end_angle: 270, line_width: 18, color: theme.track })
      c.createWidget(hmUI.widget.ARC_PROGRESS, { x: 140, y: 40, w: 200, h: 200, start_angle: -90, end_angle: 270, line_width: 18,
        level: Math.min(100, Math.round((cal.eaten / (cal.goal || 1)) * 100)), color: over ? theme.over : theme.calories })
      text({ x: 160, y: 110, w: 160, h: 50, text: String(Math.abs(cal.remaining)), text_size: 40, color: over ? theme.over : theme.text })
      text({ x: 160, y: 160, w: 160, h: 30, text: t(over ? 'dash.over' : 'dash.remaining'), text_size: 18, color: theme.muted })
      text({ x: 50, y: 250, w: 190, h: 30, text: `${t('dash.eaten')} ${cal.eaten}` })
      text({ x: 240, y: 250, w: 190, h: 30, text: `${t('dash.burned')} ${cal.burned}` })

      MACROS.forEach((m, i) => {
        const ry = 300 + i * 40
        const { value, goal } = macros[m]
        text({ x: 60, y: ry, w: 100, h: 30, text: t(`dash.${m}`), text_size: 20, color: theme.muted, align_h: hmUI.align.LEFT })
        bar(ry + 10, value / (goal || 1), theme[m], { x: 165, w: 150 })
        text({ x: 320, y: ry, w: 100, h: 30, text: `${value}/${goal}`, text_size: 20 })
      })

      text({ x: 60, y: 480, w: 120, h: 30, text: t('dash.water'), align_h: hmUI.align.LEFT })
      this.waterTxt = text({ x: 180, y: 480, w: 240, h: 30, text: `${water.ml}/${water.goal_ml} ml`, color: theme.water })
      this.waterBar = bar(520, water.ml / (water.goal_ml || 1), theme.water, { x: 70, w: 340 })
      const prim = T.containers.find((k) => k.is_primary) || T.containers[0]
      const add = (ch) => () => {
        const n = addWater(prim, ch)
        const w = loadToday().water
        this.waterTxt.setProperty(hmUI.prop.TEXT, `${w.ml}/${w.goal_ml} ml`)
        this.waterBar.setProperty(hmUI.prop.W, Math.round(340 * Math.min(w.ml / (w.goal_ml || 1), 1)))
        this.syncBtn.setProperty(hmUI.prop.TEXT, syncLabel(n))
      }
      if (prim) {
        btn(540, '−', theme.card, add(-1), { x: 70, w: 160 })
        btn(540, '+', theme.card, add(1), { x: 250, w: 160 })
      }

      const next = T.doses.filter((d) => !d.done).sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for))[0]
      const go = (key) => () => navigate({ url: 'page/list', params: JSON.stringify({ key }) })
      const cards = [
        [`${t('dash.meds')}: ${next ? `${hhmm(next.scheduled_for)} ${next.label}` : t('dash.noDoses')}`, go('meds')],
        [`${t('dash.cycle')}: ${T.cycle ? `${T.cycle.phase} ${T.cycle.cycleDay}` : '-'}`, go('cycle')],
        [t('dash.mood'), go('mood')], [t('dash.symptom'), go('symptom')], [t('dash.food'), go('food')],
        [`${t('dash.fasting')}: ${T.fasting ? t('dash.active') : '-'}`, () => navigate({ url: 'page/fasting' })]
      ]
      y = 620
      cards.forEach(([label, click]) => { btn(y, label, theme.card, click); y += 72 })
    } else {
      text({ x: 40, y: 160, w: 400, h: 120, text: t('dash.syncToDownload'), color: theme.muted, text_style: hmUI.text_style.WRAP })
    }
    this.syncBtn = btn(y, syncLabel(load().length), theme.accent, () => this.sync())
    // folga para o botão não ficar preso na curva da tela
    text({ x: 0, y: y + 70, w: 480, h: 60, text: '' })
  },
  async sync() {
    showToast({ content: t('dash.syncing') })
    // Falha de sensor não pode impedir o envio do que já está na fila.
    try { await collectHealth() } catch (e) {}
    this.request({ method: 'sync', params: { entries: load() } }, { timeout: 60000 })
      .then(({ synced = [], today, error }) => {
        remove(synced)
        if (today) {
          saveToday(today)
          try { scheduleReminders(today.doses) } catch (e) {}
        }
        showToast({ content: error ? `${t('dash.error')}: ${error}` : `${synced.length} ${t('dash.sent')}` })
        if (today) replace({ url: 'page/index' })
        else this.syncBtn.setProperty(hmUI.prop.TEXT, `${t('dash.sync')} (${load().length})`)
      })
      .catch(() => showToast({ content: t('dash.disconnected') }))
  }
}))

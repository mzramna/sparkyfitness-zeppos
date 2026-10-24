// Gera bundle de um módulo do app com @zos/* e @zeppos/zml/* trocados por fakes em globalThis.__zos.
import { build } from 'esbuild'

const FAKE = {
  '@zos/storage': 'export const localStorage = Z.storage',
  '@zos/ui': 'const u = Z.ui; export default u; export const { createWidget, deleteWidget, widget, prop, align, text_style, event } = u',
  '@zos/router': 'export const push = (o) => Z.calls.push(["push", o]); export const back = () => Z.calls.push(["back"]); export const replace = (o) => Z.calls.push(["replace", o])',
  '@zos/interaction': 'export const showToast = (o) => Z.calls.push(["toast", o.content])',
  '@zos/sensor': 'export const { Step, Calorie, HeartRate, Sleep } = Z.sensors',
  '@zos/alarm': 'export const set = (o) => Z.alarm.set(o); export const cancel = (id) => Z.alarm.cancel(id)',
  '@zos/notification': 'export const notify = (o) => Z.notify(o)',
  '@zos/app-service': 'export const exit = () => Z.calls.push(["exit"])',
  '@zos/i18n': 'export const getText = (k) => k',
  '@zeppos/zml/base-page': 'export const BasePage = (o) => o',
  '@zeppos/zml/base-app': 'export const BaseApp = (o) => o',
  '@zeppos/zml/base-side': 'export const BaseSideService = (o) => o; export const settingsLib = Z.settings'
}

export async function load(entry) {
  const { outputFiles } = await build({ entryPoints: [entry], bundle: true, format: 'esm', write: false,
    plugins: [{ name: 'zos', setup(b) {
      b.onResolve({ filter: /^@(zos|zeppos\/zml)\// }, (a) => ({ path: a.path, namespace: 'zos' }))
      b.onLoad({ filter: /.*/, namespace: 'zos' }, (a) => {
        if (!FAKE[a.path]) throw new Error(`sem fake para ${a.path}`)
        return { contents: 'const Z = globalThis.__zos;\n' + FAKE[a.path] }
      })
    } }] })
  return import('data:text/javascript,' + encodeURIComponent(outputFiles[0].text) + `#${Math.random()}`)
}

// Estado fake novo a cada teste. Páginas/serviços registram-se via Page()/AppSideService()/AppService().
export function reset({ settings = {}, routes = {}, sensors = {} } = {}) {
  const store = new Map()
  const widgets = []
  const alarms = new Map()
  let nextAlarm = 1
  const Z = {
    calls: [],
    storage: { getItem: (k, d) => (store.has(k) ? store.get(k) : d), setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k), _map: store },
    ui: {
      widget: new Proxy({}, { get: (_, k) => k }), prop: new Proxy({}, { get: (_, k) => k }),
      align: new Proxy({}, { get: (_, k) => k }), text_style: new Proxy({}, { get: (_, k) => k }), event: new Proxy({}, { get: (_, k) => k }),
      createWidget(type, props) {
        const w = { type, props: { ...props }, setProperty(p, v) { this.props[p] = v }, getProperty(p) { return this.props[p] },
          addEventListener(ev, fn) { this.props['on_' + ev] = fn }, createWidget: (t, p) => Z.ui.createWidget(t, p) }
        widgets.push(w)
        return w
      },
      deleteWidget(w) { const i = widgets.indexOf(w); if (i >= 0) widgets.splice(i, 1) }
    },
    widgets,
    sensors: Object.fromEntries(['Step', 'Calorie', 'HeartRate', 'Sleep'].map((n) => [n, class {
      constructor() { if (!(n in sensors)) throw new Error(`${n} indisponível`); Object.assign(this, sensors[n]) }
    }])),
    alarm: { set: (o) => { const id = nextAlarm++; alarms.set(id, o); return id }, cancel: (id) => alarms.delete(id), _map: alarms },
    notified: [],
    notify: (o) => { Z.notified.push(o); return Z.notified.length },
    settings: { getItem: (k) => settings[k], setItem: (k, v) => { settings[k] = v } },
    fetched: [],
    routes
  }
  globalThis.__zos = Z
  globalThis.fetch = async (req) => {
    Z.fetched.push({ ...req, body: req.body ? JSON.parse(req.body) : undefined })
    const path = req.url.replace(/^https?:\/\/[^/]+/, '')
    const r = Z.routes[`${req.method} ${path}`] ?? Z.routes[path]
    if (r === undefined) return { status: 404, body: '' }
    const v = typeof r === 'function' ? r(req) : r
    return v && v.status ? v : { status: 200, body: JSON.stringify(v) }
  }
  globalThis.Page = (o) => { Z.page = o }
  globalThis.App = (o) => { Z.app = o }
  globalThis.AppSideService = (o) => { Z.side = o }
  globalThis.AppService = (o) => { Z.service = o }
  globalThis.AppSettingsPage = (o) => { Z.setting = o }
  return Z
}

// Encontra widget por texto e dispara o clique.
export function tap(Z, text) {
  const w = Z.widgets.find((x) => x.props.text === text || String(x.props.text).startsWith(text))
  if (!w) throw new Error(`widget "${text}" não encontrado: ${Z.widgets.map((x) => x.props.text).filter(Boolean).join(' | ')}`)
  ;(w.props.click_func || w.props.on_CLICK_UP)(w)
  return w
}

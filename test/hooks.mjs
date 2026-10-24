// Hooks de módulo: importam o código REAL do app (para a cobertura do Node medir os arquivos),
// trocando @zos/* e @zeppos/zml/* por fakes que leem globalThis.__zos.
// O token r=N na query isola cada load(); stubs=<dir> troca ../utils/<nome> por arquivos de stub.
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { basename, extname } from 'node:path'

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

export async function resolve(spec, ctx, next) {
  const [parent, query = ''] = (ctx.parentURL ?? '').split('?')
  const params = new URLSearchParams(query)
  if (/^@(zos|zeppos\/zml)\//.test(spec)) return { url: `zos-fake:${spec}?${query}`, shortCircuit: true }
  if (!spec.startsWith('.') || !parent.startsWith('file:')) return next(spec, ctx)
  let url = new URL(spec, parent)
  if (!extname(url.pathname)) url = new URL(url.href + '.js')
  const dir = params.get('stubs')
  if (dir && url.pathname.includes('/utils/')) {
    const stub = `${dir}/${basename(url.pathname)}`
    if (existsSync(stub)) url = pathToFileURL(stub)
  }
  return { url: `${url.href}?${query}`, shortCircuit: true }
}

export async function load(url, ctx, next) {
  if (url.startsWith('zos-fake:')) {
    const spec = url.slice(9).split('?')[0]
    if (!FAKE[spec]) throw new Error(`sem fake para ${spec}`)
    return { format: 'module', source: 'const Z = globalThis.__zos;\n' + FAKE[spec], shortCircuit: true }
  }
  if (!url.startsWith('file:')) return next(url, ctx)
  return { format: 'module', source: readFileSync(fileURLToPath(url.split('?')[0])), shortCircuit: true }
}

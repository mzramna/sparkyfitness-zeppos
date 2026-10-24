import { test } from 'node:test'
import assert from 'node:assert/strict'
import { load, reset } from './helpers.mjs'

globalThis.Section = (props, children) => ({ props, children })
globalThis.Select = (props) => props

test('campos mostram o valor salvo e onChange grava sem espaços', async () => {
  const Z = reset()
  const m = new Map([['server', 'https://a.b']])
  const settingsStorage = { getItem: (k) => m.get(k), setItem: (k, v) => m.set(k, v) }
  globalThis.View = (props, children) => ({ props, children })
  globalThis.Text = (props, children) => ({ props, children })
  globalThis.TextInput = (props) => props
  await load('setting/index.js')
  const [, server, key] = Z.setting.build({ settingsStorage }).children
  assert.equal(server.value, 'https://a.b')
  assert.equal(key.value, '')
  server.onChange('  https://x.y  ')
  key.onChange(' k ')
  assert.equal(m.get('server'), 'https://x.y')
  assert.equal(m.get('apiKey'), 'k')
})

test('seção de sensores: padrão Health Connect, escolha grava sensorMode e a ajuda muda', async () => {
  const Z = reset()
  const m = new Map()
  const settingsStorage = { getItem: (k) => m.get(k), setItem: (k, v) => m.set(k, v) }
  globalThis.View = (props, children) => ({ props, children })
  globalThis.Text = (props, children) => ({ props, children })
  globalThis.TextInput = (props) => props
  await load('setting/index.js')
  const section = () => Z.setting.build({ settingsStorage }).children[3]
  let sec = section()
  assert.equal(sec.props.title, 'Dados medidos pelo relógio (passos, FC, sono, calorias)')
  const [select, help] = sec.children
  assert.deepEqual(select.options, [{ name: 'Via Health Connect', value: 'health-connect' }, { name: 'Direto pela API', value: 'direct' }])
  assert.equal(select.value, 'health-connect') // padrão sem valor salvo
  assert.match(help.children, /docs\/health-connect\.md/)
  select.onChange('direct')
  assert.equal(m.get('sensorMode'), 'direct')
  sec = section()
  assert.equal(sec.children[0].value, 'direct')
  assert.match(sec.children[1].children, /em dobro/)
  sec.children[0].onChange('health-connect')
  assert.equal(m.get('sensorMode'), 'health-connect')
  assert.match(section().children[1].children, /docs\/health-connect\.md/)
})

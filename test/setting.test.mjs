import { test } from 'node:test'
import assert from 'node:assert/strict'
import { load, reset } from './helpers.mjs'

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

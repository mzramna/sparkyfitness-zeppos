# CLAUDE.md — sparkyfitness-zeppos (SparkyFitness para Zepp OS)

Leia também `HANDOFF.md` (estado atual), `CONTRACT.md` (contrato relógio↔celular↔servidor) e `README.md`.

## Regras gerais
- Responder ao usuário em **português (PT-BR)**.
- **Nunca** commitar em `main`: branch `feat/...` + PR; pipeline `ci/test` e `ci/build` precisa passar.
- Features valem para **modern e `legacy/`** (API 1.0); se não der, dizer.
- Segredos (API key) sempre mascarados na UI (`maskSecret`: só últimos 4).

## Estrutura
| Caminho | Papel |
|---|---|
| `page/index.js` | Dashboard (calorias, macros, água, cartões, sync) |
| `page/list.js` | Abas água/remédios/ciclo/humor/sintomas/comida com paginação, deslize e coroa |
| `page/fasting.js` | Jejum |
| `utils/queue.js` | Fila offline (`push/load/remove`) e cache do dia (`loadToday/saveToday/addWater`) |
| `utils/direct-sync.js` | Sync direto via Wi-Fi (`fetch` do relógio) com o servidor; mesma resposta do `app-side` |
| `utils/reminders.js` + `app-service/med_reminder.js` | Alarmes por dose e notificação com ações |
| `app-side/**` | Side service no celular (API SparkyFitness), repassa `config` ao relógio |
| `setting/index.js` | Configurações no app Zepp (servidor, API key, modo de sensores) |
| `legacy/` | App para API 1.0, copiado inteiro no build 1.0 |
| `build.config.js`, `scripts/build.js` | Perfis por API e geração do `app.json` |

## Comandos
```bash
npm test                    # = node scripts/test.mjs (node --test + cobertura)
node scripts/build.js --api all
```

## Convenções
- **Performance no relógio**: nada pesado em `build()` (sem reagendar alarmes, sem loops de storage). Storage/alarme são IPC lentos.
- **Coroa**: dispara vários eventos por giro → trave (uma ação por giro) e libere em `onDestroy` (`offDigitalCrown`, `offGesture`).
- **Gestos**: não retornar `true` para o deslize à direita quando não há navegação interna — deixa o sistema voltar.
- **Sync**: `canDirectSync()` → `directSync()`; em erro cai para `this.request({ method: 'sync' })` (BLE).
- **Settings**: sem `cond && X` em arrays de filhos; `TextInput` de segredo com valor mascarado e `onChange` ignorando vazio/máscara.
- **Testes**: `test/helpers.mjs` — `reset()` cria o fake de `@zos/*`; `load(entry)` importa cada módulo uma vez (re-registra `Page/App...`) para a cobertura não diluir; com `stubs` gera instância isolada. Toda função nova com teste.

## Emulador
`/home/mzramna/Documentos/zeppos-mcp-emulator` (repo `mzramna/ZeppPlayer`) roda a suíte E2E deste app e expõe ferramentas MCP.

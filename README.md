# sparkyfitness-zeppos

App para relógios Amazfit (Zepp OS 3+) que registra dados no relógio e sincroniza com um servidor [SparkyFitness](https://github.com/CodeWithCJ/SparkyFitness) self-hosted.

## Funcionalidades
Tudo o que aparece no relógio vem da **sua instância** — nada é pré-cadastrado:
- 💧 Água: seus recipientes (`/api/water-containers`) → `POST /api/v2/measurements/water-intake`
- 💊 Remédios: seus medicamentos ativos (`/api/v2/medications`) → `POST /api/v2/medications/entries`
- 🩸 Ciclo: nível de fluxo do dia → `PUT /api/v2/cycle/logs/:data`
- 🍽️ Alimentação: alimentos recentes/mais usados (`/api/foods`) + seus tipos de refeição (`/api/meal-types`) → `POST /api/food-entries/`
- 🔄 Sincronizar: envia a fila offline e baixa o catálogo atualizado. Só sai da fila o que o servidor confirmou.

## Por que não falar direto com o app Android do SparkyFitness?
Analisei o `SparkyFitnessMobile` (Expo/React Native): ele **não expõe nenhuma interface para outros apps** — sem intents exportados, deep links que gravem dados, content provider ou servidor local; a credencial fica no SecureStore dele; o único módulo de relógio é para Apple Watch. Além disso, o side service do Zepp OS só consegue fazer HTTP, não chamar outros apps Android.

Por isso o app usa **os mesmos endpoints e o mesmo esquema de autenticação (Bearer API key) que o app Android usa**: os dados aparecem nele imediatamente, como se tivessem sido lançados por ele. Se um dia o app Android expor uma API local, basta trocar `app-side/api.js`.

## Arquitetura
```
Relógio (page/)  --BLE-->  App Zepp no celular (app-side/)  --HTTPS-->  Instância SparkyFitness  <--  App Android SparkyFitness
  fila + catálogo em cache        api.js
```

## Build
```bash
npm i -g @zeppos/zeus-cli
npm install
zeus dev      # simulador
zeus preview  # QR code para instalar no relógio (modo desenvolvedor)
```

## Configuração
1. No SparkyFitness (web): Settings → API Keys → gerar chave com escopo **full**.
2. No app Zepp → seu relógio → App Settings → SparkyFitness: URL da instância e a API key.
3. No relógio: toque em **Sincronizar** para baixar seus recipientes, remédios, alimentos e refeições.

## Pendências
- `appId` em `app.json` é provisório (gerar no Zepp Developer Console); `assets/default/icon.png` é um placeholder.
- `npm test` valida o mapeamento das requisições com `fetch` simulado (não substitui teste contra instância real).
- Não testado em dispositivo/simulador nem contra uma instância real.

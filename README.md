# sparkyfitness-zeppos

App para relógios Amazfit (Zepp OS 3+) que registra dados no relógio e sincroniza com um servidor [SparkyFitness](https://github.com/CodeWithCJ/SparkyFitness) self-hosted.

## Funcionalidades
- 💧 Ingestão de água (200/300/500 ml)
- 💊 Remédios
- 🩸 Registro menstrual (início, fluxo, fim)
- 🍽️ Registro alimentar básico (refeição)
- 🔄 Sincronização: fila offline no relógio, enviada pelo celular (side service) ao servidor; só sai da fila o que o servidor confirmou

## Arquitetura
```
Relógio (page/)  --BLE-->  App Zepp no celular (app-side/)  --HTTPS-->  SparkyFitness
   fila local                 api.js mapeia registro → HTTP
```
- `utils/catalog.js` — botões rápidos (edite para seus remédios/porções)
- `utils/queue.js` — fila persistente no relógio
- `app-side/api.js` — **único** ponto de mapeamento para a API do servidor
- `setting/` — URL do servidor e API key (configurados no app Zepp)

## Build
```bash
npm i -g @zeppos/zeus-cli
npm install
zeus dev      # simulador
zeus preview  # QR code para instalar no relógio (modo desenvolvedor)
```

## Configuração
No app Zepp → Perfil → seu relógio → App Settings → SparkyFitness: informe a URL do servidor e uma API key gerada no SparkyFitness.

## ⚠️ Pendências
- Os payloads em `app-side/api.js` assumem o endpoint `/api/health-data`. **Confirme os tipos/campos aceitos pela sua versão do SparkyFitness** e ajuste o mapeamento (água costuma ser suportada; remédios, ciclo e refeições podem exigir endpoints próprios).
- `appId` em `app.json` é provisório: gere um oficial no Zepp Developer Console.
- Falta `assets/default/icon.png`.

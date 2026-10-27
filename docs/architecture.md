# Arquitetura e Funcionamento — SparkyFitness Zepp OS Companion (`sparkyfitness-zeppos`)

Este documento detalha a arquitetura, modelo de dados, sincronização e interfaces do aplicativo companheiro do SparkyFitness para Zepp OS.

---

## 1. Visão Geral da Solução

O app permite monitorar e registrar hidratação (água com recipientes personalizados), doses de medicamentos com notificações, jejum intermitente, refeições, ciclo e humor, integrando dados com a plataforma SparkyFitness.

### Camadas do Sistema
1. **Watch App (`page/**` e `legacy/**`)**:
   - `page/index.js`: Dashboard principal com balanço de calorias, metas de macronutrientes, hidratação interativa e atalhos rápidos.
   - `page/list.js`: Abas paginadas para registro rápido de água, medicamentos, ciclo menstrual, humor, sintomas e refeições.
   - `page/fasting.js`: Controle de jejum intermitente com protocolos configuráveis (16:8, 18:6, etc.) e temporizador ativo.
2. **Background Service (`app-service/med_reminder.js`)**:
   - Serviço em segundo plano acionado por alarmes nativos (`@zos/alarm`) nos horários agendados das doses para disparar notificações interativas com ações "Tomado" e "Pular".
3. **Fila Offline e Sincronização (`utils/queue.js` e `utils/direct-sync.js`)**:
   - Fila FIFO armazenada no localStorage do relógio para garantir registro mesmo sem nenhuma conexão.
   - Sincronização direta via Wi-Fi do relógio com o servidor SparkyFitness (com fallback transparente para o smartphone via Bluetooth/App-Side).

---

## 2. Prevenção de Travamentos e Cuidados de Desempenho

O hardware dos smartwatches Zepp possui restrições severas de CPU e barramento I/O:
- **Agendamento de Alarmes**: O reagendamento de múltiplos alarmes em lote é custoso. Ele só é invocado após o término de um ciclo de sincronização ou após a confirmação manual de uma dose, **nunca** de forma reativa a cada renderização da tela principal.
- **Coroa Digital**: Em telas com rolagem vertical (`VIEW_CONTAINER`), a coroa digital deve permanecer desimpedida para rolagem de tela. Disparar gravações de estado em disco a cada passo da coroa provoca saturação e congelamento da UI.
- **Gesto de Voltar**: Nas abas (`page/list.js`), o deslize para a direita na primeira página da lista deve ser preservado para que o sistema execute a ação nativa de "voltar".

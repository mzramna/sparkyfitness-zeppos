# Diretivas de Planejamento e Handoff para Agentes — SparkyFitness Zepp OS

Este documento orienta agentes de inteligência artificial sobre diretivas de desenvolvimento contínuo, padrões de testes e regras de entrega no projeto SparkyFitness Zepp OS.

---

## 1. Diretivas de Git e Entrega

1. **PROIBIDO COMMITAR DIRETAMENTE NA `main` OU `master`**:
   - Todo código deve ser desenvolvido na branch `feat/zepp-crown-wifi-reminders-and-fixes` ([PR #4](https://github.com/mzramna/sparkyfitness-zeppos/pull/4)).
   - CI (`ci/test` e `ci/build`) deve permanecer 100% verde antes de qualquer solicitação de merge.

2. **Cobertura de Código Sem Diluição**:
   - `test/helpers.mjs` utiliza um cache de módulo singleton (`loadOnce`) para evitar recargas artificiais (`?r=N`) que diluem a contagem total de cobertura do Node.js.
   - A cobertura de linhas e funções deve ser mantida próxima de 100% em todos os testes unitários.

---

## 2. Diretivas de UI e Privacidade de Dados

1. **Máscara de Chaves de API**:
   - Chaves de API em `setting/index.js` e `legacy/setting/index.js` devem exibir apenas os últimos 4 caracteres.
   - O campo de texto deve possuir contenção estrita (`overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`) para evitar quebras visuais na interface mobile da Zepp.

2. **Lembretes de Medicamentos**:
   - As notificações acionam o `app-service/med_reminder.js`, que atualiza a dose correspondente no cache diário local e enfileira a marcação para envio no próximo sync.

---

## 3. Roteiro de Testes e Validação em Hardware

- Testar o comportamento das notificações de doses quando o relógio estiver em modo descanso de tela.
- Validar a precisão das taxas de queima calórica e contagem de passos agregadas via Health Connect vs sensores diretos no pulso.

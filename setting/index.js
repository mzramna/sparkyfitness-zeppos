AppSettingsPage({
  build({ settingsStorage: s }) {
    const field = (label, key, placeholder) => TextInput({ label, placeholder, value: s.getItem(key) || '',
      onChange: (v) => s.setItem(key, v.trim()) })
    // Padrão: Health Connect. A ajuda muda com a escolha (build roda de novo a cada mudança no storage).
    const mode = s.getItem('sensorMode') || 'health-connect'
    const help = mode === 'direct'
      ? 'Não ative também essas métricas na sincronização do Health Connect do app SparkyFitness, ou os dados aparecem em dobro.'
      : '1) App Zepp: permitir passos, FC, sono e calorias no Health Connect. 2) Health Connect: pôr o Zepp à frente nas prioridades. 3) SparkyFitness Android: ativar essas métricas em Sync. Veja docs/health-connect.md.'
    return View({ style: { padding: '12px' } }, [
      Text({ bold: true }, 'SparkyFitness'),
      field('URL do servidor', 'server', 'https://sparky.example.com'),
      field('API key', 'apiKey', 'Gerada em Settings > API Keys'),
      Section({ title: 'Dados medidos pelo relógio (passos, FC, sono, calorias)' }, [
        Select({ value: mode, options: [{ name: 'Via Health Connect', value: 'health-connect' }, { name: 'Direto pela API', value: 'direct' }],
          onChange: (v) => s.setItem('sensorMode', v) }),
        Text({ paragraph: true }, help)
      ])
    ])
  }
})

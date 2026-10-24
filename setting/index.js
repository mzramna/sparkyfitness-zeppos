AppSettingsPage({
  build({ settingsStorage: s }) {
    const field = (label, key, placeholder) => TextInput({ label, placeholder, value: s.getItem(key) || '',
      onChange: (v) => s.setItem(key, v.trim()) })
    return View({ style: { padding: '12px' } }, [
      Text({ bold: true }, 'SparkyFitness'),
      field('URL do servidor', 'server', 'https://sparky.example.com'),
      field('API key', 'apiKey', 'Gerada em Settings > API Keys')
    ])
  }
})

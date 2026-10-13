// Funções puras do jogo (sem tela nem navegador), cobertas pelos testes em tests/.

export const hora = (ts) => new Date(ts * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

export function haQuanto(ts, agora = Date.now() / 1000) {
  if (!ts) return 'faz tempo'
  const s = Math.max(0, agora - ts)
  if (s < 90) return 'agora há pouco'
  const plural = (n, um, varios) => `há ${n} ${n === 1 ? um : varios}`
  if (s < 3600) return plural(Math.floor(s / 60), 'minuto', 'minutos')
  if (s < 86400) return plural(Math.floor(s / 3600), 'hora', 'horas')
  return plural(Math.floor(s / 86400), 'dia', 'dias')
}

// Quebra um texto em até `maxLinhas` linhas de `largura` letras; o que sobrar vira reticências.
export function quebrar(texto, largura, maxLinhas) {
  const linhas = ['']
  for (const palavra of texto.split(/\s+/)) {
    const atual = linhas[linhas.length - 1]
    if (!atual) linhas[linhas.length - 1] = palavra.slice(0, largura)
    else if ((atual + ' ' + palavra).length <= largura) linhas[linhas.length - 1] = atual + ' ' + palavra
    else if (linhas.length < maxLinhas) linhas.push(palavra.slice(0, largura))
    else {
      linhas[linhas.length - 1] = atual.slice(0, largura - 1) + '…'
      break
    }
  }
  return linhas
}

export function direcaoPara(de, [x, y]) {
  if (Math.abs(x - de.x) > Math.abs(y - de.y)) return x > de.x ? 'right' : 'left'
  return y > de.y ? 'down' : 'up'
}

// manhã, tarde (fim do dia) ou noite, para a luz das janelas
export function periodoDoDia(data = new Date()) {
  const h = data.getHours()
  if (h >= 6 && h < 17) return 'dia'
  if (h >= 17 && h < 19) return 'tarde'
  return 'noite'
}

// Linhas do quadro de avisos: falhas primeiro, depois o que está por vir, o que já rodou e o que está desligado.
export function linhasDoQuadro(quadro, donos, nomes) {
  const ordem = { falha: 0, espera: 1, ok: 2, off: 3 }
  return quadro
    .map((q) => {
      const dono = nomes[donos[q.label]]
      const nome = q.nome.toUpperCase() + (dono ? ` (${dono})` : '')
      const ritmo = q.intervaloMin ? ` · a cada ${q.intervaloMin} min` : q.proxima ? ` · próxima ${q.proxima}` : ''
      if (q.desativada) return { marca: 'DESLIGADA', tom: 'off', texto: nome }
      if (q.rodando) return { marca: 'RODANDO', tom: 'espera', texto: nome }
      if (q.rodouHoje && q.saida) return { marca: 'FALHOU', tom: 'falha', texto: `${nome} · ${hora(q.ultima)} · código ${q.saida}` }
      if (q.rodouHoje) return { marca: 'OK', tom: 'ok', texto: `${nome} · última ${hora(q.ultima)}${ritmo}`, ts: q.ultima }
      if (q.proxima) return { marca: 'VAI RODAR', tom: 'espera', texto: `${nome} · ${q.proxima}` }
      return { marca: 'HOJE NÃO', tom: 'off', texto: nome }
    })
    .sort((a, b) => ordem[a.tom] - ordem[b.tom] || (b.ts || 0) - (a.ts || 0))
}

// Linhas do histórico de pedidos feitos pelo jogo (mais recente primeiro).
export function linhasDoHistorico(itens, nomes) {
  return itens.map((i) => {
    const quando = new Date(i.quando * 1000)
    const dia = quando.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    const real = i.modo === 'real'
    return {
      marca: !real ? 'SIMULADO' : i.ok ? 'OK' : 'FALHOU',
      tom: !real ? 'off' : i.ok ? 'ok' : 'falha',
      texto: `${dia} ${hora(i.quando)} · ${nomes[i.agente] || i.agente} · ${i.tipo === 'analise' ? 'ANÁLISE' : 'ROTINA'}: ${i.titulo}${i.resultado ? ` · ${i.resultado}` : ''}`,
    }
  })
}

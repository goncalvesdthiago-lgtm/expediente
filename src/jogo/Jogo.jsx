import { useEffect, useRef, useState } from 'react'
import '@fontsource/jersey-10'
import './jogo.css'
import { T, criarPersonagem, criarTiles } from './sprites.js'
import {
  AGENTES, CAFE, COLUNAS, CONFIG, JANELAS, LETREIROS, LINHAS, MAPAS, OPOSTO, PASSAGENS, PASSOS, RELOGIO, TAPETE, TELOES,
  caminho, letra, solido,
} from './mapa.js'
import { alternarMudo, alternarMusica, estaMudo, ligarSom, som, temMusica } from './som.js'
import { direcaoPara, haQuanto, hora, linhasDoHistorico, linhasDoQuadro, periodoDoDia, quebrar } from './util.js'
import { DEMO, EVENTOS_DEMO, FOFOCAS, ROTINAS_DEMO, estadoDemo } from './demo.js'

const VELOCIDADE = 5.5 // quadros por segundo do jogador
const VELOCIDADE_NPC = 4
const ESPERA_MENU = 0.35 // segundos parado de frente para abrir o menu sozinho
const TECLAS_DIRECAO = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right',
}
const CONFIRMA = ['Enter', ' ', 'z']
const VOLTA = ['Escape', 'x']
const OBJETOS = 'QqSsEHh'
const POR_ID = Object.fromEntries(AGENTES.map((a) => [a.id, a]))
const NOMES = Object.fromEntries(AGENTES.map((a) => [a.id, a.nome]))
const CHEFE = AGENTES[0].id // quem você controla ao abrir o jogo
const FONTE = '"Jersey 10"'



const postar = (url, corpo) =>
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
    .then((r) => r.json())
    .catch((e) => ({ erro: String(e.message || e) }))
const ler = (url) => fetch(url).then((r) => r.json()).catch(() => ({}))



export default function Jogo() {
  const tela = useRef(null)
  const rolagem = useRef(null)
  const [escala, setEscala] = useState(3)
  const [ui, setUi] = useState(null)
  const [letras, setLetras] = useState(0)
  const [controlado, setControlado] = useState(CHEFE)
  const [modoReal, setModoReal] = useState(false)
  const [mudo, setMudo] = useState(estaMudo())
  const [musica, setMusica] = useState(temMusica())
  const [abertura, setAbertura] = useState(true)
  const aberturaRef = useRef(true)
  const modoRealRef = useRef(false)

  const uiRef = useRef(null)
  const letrasRef = useRef(0)
  letrasRef.current = letras
  const dados = useRef({ agentes: {}, rotinas: {}, donos: {}, estado: null })
  const mundo = useRef(null)
  if (!mundo.current) {
    const npcs = {}
    AGENTES.forEach((a) => {
      if (a.id !== CHEFE) npcs[a.id] = { x: a.assento[0], y: a.assento[1], dir: 'up', resto: 0, missao: null }
    })
    mundo.current = {
      mapa: 'escritorio',
      jogador: { id: CHEFE, x: 9, y: 7, dir: 'down', resto: 0, giro: 0 },
      npcs,
      pilha: [],
      parado: 0,
      ultimoGatilho: '',
      emotes: {},
      baloes: {},
      ocupados: {}, // agentes com rotina ou análise em andamento
      recados: [], // resultados para o agente que você mesmo está controlando
      historico: [], // pedidos da demonstração (os reais ficam no servidor)
      vistos: null,
      escuro: 0,
      proximoCafe: performance.now() + 12000,
      tempo: 0, // relógio do jogo em ms; anda junto com o laço
      cena: null, // cena roteirizada em andamento (fofoca da demonstração)
    }
  }
  const m = mundo.current

  // Ações do jogo. Ficam num objeto estável; só mexem em refs, então não envelhecem entre renders.
  const A = useRef({}).current

  A.abrir = (novo) => {
    uiRef.current = novo
    setLetras(0)
    setUi(novo)
  }
  A.fechar = () => A.abrir(null)

  // Encadeia falas na caixa de texto; ao fim chama `depois` (ou fecha).
  A.falar = (nome, textos, depois) => {
    const [primeiro, ...resto] = textos
    A.abrir({
      tipo: 'fala',
      nome,
      texto: primeiro,
      proximo: () => (resto.length ? A.falar(nome, resto, depois) : depois ? depois() : A.fechar()),
    })
  }
  A.painel = (titulo, linhas) => A.abrir({ tipo: 'painel', titulo, linhas, aoCancelar: A.fechar })

  A.emote = (id, tipo, segundos) => {
    m.emotes[id] = { tipo, ate: performance.now() + segundos * 1000 }
  }
  A.balao = (id, texto, segundos = 6) => {
    m.baloes[id] = { linhas: quebrar(texto, 30, 4), ate: m.tempo + segundos * 1000 }
  }
  // Começa uma cena roteirizada, se todo o elenco estiver livre na própria mesa.
  A.cena = (passos) => {
    const elenco = new Set(passos.flatMap((p) => [...(p.ir || []).map((i) => i[0]), ...(p.fala ? [p.fala[0]] : [])]))
    const livre = [...elenco].every((id) => m.npcs[id] && !m.npcs[id].missao && !m.ocupados[id])
    if (m.cena || !livre) return false
    m.cena = { passos, i: 0, t: 0, novo: true }
    return true
  }
  A.npcEm = (x, y) => (m.mapa === 'escritorio' ? Object.keys(m.npcs).find((id) => m.npcs[id].x === x && m.npcs[id].y === y) : undefined)

  // O agente leva o resultado até você (ou fala direto, se for o agente que você controla).
  A.entregar = (id, linhas, depois) => {
    delete m.emotes[id]
    if (m.jogador.id === id || !m.npcs[id]) m.recados.push({ id, linhas, depois })
    else m.npcs[id].missao = { tipo: 'entrega', fase: 'indo', linhas, depois }
  }

  // Guarda o pedido no histórico: no servidor (dados/historico.jsonl) ou, na demonstração, só na memória.
  A.registrar = (item) => {
    if (DEMO) m.historico.unshift({ quando: Math.floor(Date.now() / 1000), ...item, modo: 'real' })
    else postar('/api/historico', item)
  }

  A.acompanharRotina = (id, indice, rotulo, pedido) => {
    const inicio = Date.now()
    const fim = (linhas, ok, resultado) => {
      A.registrar({ agente: id, tipo: 'rotina', titulo: rotulo, modo: pedido.modo, ok, resultado, segundos: Math.round((Date.now() - inicio) / 1000) })
      A.entregar(id, linhas)
    }
    if (pedido.modo === 'demo') {
      setTimeout(() => fim([`Pronto! “${rotulo}” terminou sem erro.`, 'Fim do log: 128 linhas atualizadas em 4 segundos.'], true, 'terminou sem erro'), 9000)
      return
    }
    const simulado = pedido.modo === 'simulado'
    let semResposta = 0
    const ver = async () => {
      const e = await ler(`/api/rotina-estado?agente=${id}&indice=${indice}`)
      if (e.existe === undefined) {
        // o servidor do jogo não respondeu; tenta mais algumas vezes antes de desistir
        if (++semResposta < 5) return setTimeout(ver, 3000)
        return fim([`Perdi o contato com o servidor do jogo e não sei como “${rotulo}” terminou. Veja o quadro de avisos.`], false, 'sem contato com o servidor')
      }
      semResposta = 0
      const acabou = simulado ? Date.now() - inicio > 3500 : e.execucoes > pedido.execucoesAntes && !e.rodando
      if (!acabou && Date.now() - inicio < 15 * 60 * 1000) return setTimeout(ver, simulado ? 1200 : 3000)
      const ultimaLinha = e.logFim?.length ? [`Fim do log: ${e.logFim[e.logFim.length - 1]}`] : []
      if (simulado) {
        const anterior = e.existe
          ? `Na última execução real ela terminou ${e.saida === 0 ? 'sem erro' : `com erro (código ${e.saida})`}${e.ultima ? `, às ${hora(e.ultima)}` : ''}.`
          : 'Não achei essa rotina no agendador do Mac.'
        return fim([`(SIMULAÇÃO) Não rodei “${rotulo}” de verdade.`, anterior, ...ultimaLinha], true, 'simulado')
      }
      if (!acabou) return fim([`“${rotulo}” ainda está rodando depois de 15 minutos. Pode ter travado; melhor olhar o log.`], false, 'não terminou em 15 minutos')
      if (e.vpnDesligada) return fim([`“${rotulo}” não rodou: a VPN estava desligada e a rotina foi pulada. Ligue a VPN e me peça de novo.`], false, 'pulada: VPN desligada')
      if (e.saida === 0) return fim([`Pronto! “${rotulo}” terminou sem erro.`, ...ultimaLinha], true, 'terminou sem erro')
      fim([`“${rotulo}” terminou com erro (código ${e.saida}).`, ...ultimaLinha], false, `erro, código ${e.saida}`)
    }
    setTimeout(ver, 1200)
  }

  A.acompanharAnalise = (id, pedido, resposta) => {
    const nome = POR_ID[id].nome
    const inicio = Date.now()
    const fim = (linhas, ok, resultado, depois) => {
      A.registrar({ agente: id, tipo: 'analise', titulo: pedido, modo: resposta.modo, ok, resultado, segundos: Math.round((Date.now() - inicio) / 1000) })
      A.entregar(id, linhas, depois)
    }
    if (resposta.modo === 'demo') {
      setTimeout(() => fim(['Olhei os números de exemplo: as vendas da semana subiram 12%, puxadas pelo plano anual.'], true, 'respondida'), 7000)
      return
    }
    if (resposta.modo === 'simulado') {
      setTimeout(() => fim([`(SIMULAÇÃO) Eu responderia aqui a “${pedido}”. Nada foi enviado ao Kiro.`], true, 'simulado'), 3500)
      return
    }
    let semResposta = 0
    const ver = async () => {
      const t = await ler(`/api/analise-estado?id=${resposta.id}`)
      if (t.erro) return fim([t.erro], false, 'análise perdida')
      if (t.feito === undefined) {
        if (++semResposta < 5) return setTimeout(ver, 3000)
        return fim(['Perdi o contato com o servidor do jogo e não consegui buscar a resposta.'], false, 'sem contato com o servidor')
      }
      semResposta = 0
      if (!t.feito) return setTimeout(ver, 3000)
      if (t.motivo === 'tempo') return fim(['O Kiro não respondeu em 10 minutos e eu desisti. Tente um pedido mais curto.'], false, 'Kiro sem resposta em 10 minutos')
      if (t.motivo === 'sem-kiro') return fim(['Não achei o kiro-cli neste computador, então não consegui pedir a análise.'], false, 'kiro-cli não encontrado')
      const texto = t.texto || 'O Kiro não devolveu texto.'
      const resumo = texto.length > 240 ? texto.slice(0, 240).trimEnd() + '…' : texto
      const lerTudo = () =>
        A.abrir({
          tipo: 'menu',
          nome,
          sel: 0,
          aoCancelar: A.fechar,
          opcoes: [
            { rotulo: 'LER TUDO', fazer: () => A.painel(`RESPOSTA DE ${nome}`, texto.split('\n').map((l) => ({ texto: l || ' ' }))) },
            { rotulo: 'OK, VALEU', fazer: A.fechar },
          ],
        })
      fim([t.ok ? resumo : `O Kiro terminou com erro. ${resumo}`], !!t.ok, t.ok ? 'respondida' : 'Kiro terminou com erro', texto.length > 240 ? lerTudo : null)
    }
    setTimeout(ver, 3000)
  }

  A.menuDoAgente = (id) => {
    const ag = POR_ID[id]
    const info = dados.current.agentes[id] || {}
    const rotinas = dados.current.rotinas[id] || []
    const opcoes = rotinas.map((rotulo, indice) => ({
      rotulo: `RODAR: ${rotulo}`,
      fazer: async (confirmado) => {
        if (modoRealRef.current && !DEMO && confirmado !== true) {
          // modo real: a rotina roda de verdade no computador, então pede um "sim" antes
          return A.abrir({
            tipo: 'menu',
            nome: `RODAR “${rotulo}” DE VERDADE?`,
            sel: 1,
            aoCancelar: () => A.menuDoAgente(id),
            opcoes: [
              { rotulo: 'SIM, PODE RODAR', fazer: () => opcoes[indice].fazer(true) },
              { rotulo: 'NÃO, VOLTAR', fazer: () => A.menuDoAgente(id) },
            ],
          })
        }
        A.abrir({ tipo: 'fala', nome: ag.nome, texto: `Deixa comigo. Vou rodar “${rotulo}”…`, travada: true })
        const r = DEMO ? { modo: 'demo' } : await postar('/api/rodar', { agente: id, indice })
        if (r.erro || (r.modo === 'real' && !r.ok)) {
          return A.falar(ag.nome, [`Não consegui rodar “${rotulo}”. ${r.erro || ''}`], () => A.menuDoAgente(id))
        }
        m.ocupados[id] = true
        m.emotes[id] = { tipo: 'pontos', ate: Infinity }
        A.falar(ag.nome, ['Pode ir fazer outra coisa. Quando terminar eu vou até você.'])
        A.acompanharRotina(id, indice, rotulo, r)
      },
    }))
    opcoes.push({
      rotulo: 'QUERO FAZER UMA ANÁLISE',
      fazer: () =>
        A.abrir({
          tipo: 'entrada',
          nome: ag.nome,
          pergunta: 'Que análise você quer?',
          aoCancelar: () => A.menuDoAgente(id),
          aoEnviar: async (bruto) => {
            const pedido = bruto.trim()
            if (!pedido) return A.menuDoAgente(id)
            A.abrir({ tipo: 'fala', nome: ag.nome, texto: 'Anotado. Um instante…', travada: true })
            const r = DEMO ? { modo: 'demo' } : await postar('/api/analise', { agente: id, pedido })
            if (r.erro) return A.falar(ag.nome, [`Não consegui começar a análise. ${r.erro}`])
            m.ocupados[id] = true
            m.emotes[id] = { tipo: 'pontos', ate: Infinity }
            A.falar(ag.nome, ['Vou pensar nisso. Quando tiver a resposta eu vou até você.'])
            A.acompanharAnalise(id, pedido, r)
          },
        }),
    })
    opcoes.push({
      rotulo: 'O QUE VOCÊ FEZ HOJE?',
      fazer: () =>
        A.falar(
          ag.nome,
          info.ultima
            ? [`Minha última ação: ${info.tarefa || 'sem descrição.'}`, `Isso foi ${haQuanto(info.ultima)}. Hoje somei ${info.acoesHoje} ações.`]
            : ['Não tenho nada registrado nos últimos dias.'],
          () => A.menuDoAgente(id),
        ),
    })
    opcoes.push({ rotulo: 'NADA, VALEU', fazer: A.fechar })
    A.abrir({ tipo: 'menu', nome: ag.nome, opcoes, sel: 0, aoCancelar: A.fechar })
  }

  A.conversar = (id) => {
    const n = m.npcs[id]
    if (!n || n.missao || n.resto) return
    n.dir = OPOSTO[m.jogador.dir]
    som.confirma()
    if (m.ocupados[id]) return A.falar(POR_ID[id].nome, ['Ainda estou terminando a outra tarefa. Já te aviso!'])
    A.falar(POR_ID[id].nome, [`Oi, ${POR_ID[m.jogador.id].nome}! Em que posso ajudar?`], () => A.menuDoAgente(id))
  }

  A.quadroDeAvisos = () =>
    A.abrir({
      tipo: 'menu',
      nome: 'QUADRO DE AVISOS',
      sel: 0,
      aoCancelar: A.fechar,
      opcoes: [
        { rotulo: 'ROTINAS DE HOJE', fazer: () => A.painel('ROTINAS DE HOJE', linhasDoQuadro(dados.current.estado?.quadro || [], dados.current.donos, NOMES)) },
        {
          rotulo: 'PEDIDOS FEITOS PELO JOGO',
          fazer: async () => {
            const itens = DEMO ? m.historico : (await ler('/api/historico')).itens || []
            A.painel('PEDIDOS FEITOS PELO JOGO', itens.length ? linhasDoHistorico(itens, NOMES) : [{ texto: 'Ninguém pediu nada pelo jogo ainda.' }])
          },
        },
        { rotulo: 'FECHAR', fazer: A.fechar },
      ],
    })

  A.pausa = () =>
    A.abrir({
      tipo: 'menu',
      nome: 'MENU',
      sel: 0,
      aoCancelar: A.fechar,
      opcoes: [
        { rotulo: 'CONTINUAR', fazer: A.fechar },
        { rotulo: 'TROCAR DE AGENTE', fazer: () => A.menuTroca() },
        { rotulo: `SOM: ${estaMudo() ? 'DESLIGADO' : 'LIGADO'}`, fazer: () => (setMudo(alternarMudo()), A.pausa()) },
        { rotulo: `MÚSICA: ${temMusica() ? 'LIGADA' : 'DESLIGADA'}`, fazer: () => (setMusica(alternarMusica()), A.pausa()) },
        {
          rotulo: 'CONTROLES',
          fazer: () =>
            A.painel('CONTROLES', [
              { marca: 'SETAS', tom: 'off', texto: 'Andar. WASD também serve.' },
              { marca: 'Z / ENTER', tom: 'off', texto: 'Falar com quem está na sua frente e confirmar.' },
              { marca: 'X / ESC', tom: 'off', texto: 'Voltar. Com nada aberto, ESC abre este menu.' },
              { marca: 'TAB', tom: 'off', texto: 'Trocar o agente que você controla.' },
              { marca: 'M', tom: 'off', texto: 'Ligar e desligar o som.' },
              { texto: ' ' },
              { texto: 'Pare de frente para um agente, para o quadro de avisos ou para um telão: o menu abre sozinho.' },
            ]),
        },
      ],
    })

  A.interagir = (ch, x) => {
    const e = dados.current.estado
    som.confirma()
    if (ch === 'Q' || ch === 'q') return A.quadroDeAvisos()
    if (ch === 'E') return A.falar('', ['A saída do escritório. Mas ainda tem trabalho por aqui.'])
    if (ch === 'H' || ch === 'h') return A.falar('', ['A lousa do time. Alguém desenhou um gráfico subindo e escreveu “fé”.'])
    if (!e) return A.falar('', ['O telão ainda está carregando.'])
    const telao = TELOES[x]
    if (telao === 'indicadores') {
      const k = e.kpis
      return A.painel('INDICADORES DE HOJE', [
        { marca: String(k.sessoesHoje), tom: 'ok', texto: 'SESSÕES DO KIRO HOJE' },
        { marca: String(k.sessoesAbertas), tom: 'ok', texto: 'SESSÕES ABERTAS AGORA' },
        { marca: String(k.acoesHoje), tom: 'ok', texto: 'AÇÕES DOS AGENTES HOJE' },
        { marca: String((e.quadro || []).filter((q) => q.rodouHoje).length), tom: 'ok', texto: 'ROTINAS QUE RODARAM HOJE' },
        { marca: `${k.trabalhando}/${e.agentes.length}`, tom: 'espera', texto: 'AGENTES TRABALHANDO AGORA' },
        { texto: ' ' },
        ...e.agentes.map((a) => ({ marca: String(a.acoesHoje), tom: a.acoesHoje ? 'ok' : 'off', texto: `${POR_ID[a.id].nome} · ${a.ultima ? haQuanto(a.ultima) : 'sem registro'}` })),
      ])
    }
    if (telao === 'sessoes') {
      return A.painel('SESSÕES RECENTES DO KIRO', e.sessoes.slice(0, 12).map((s) => ({
        marca: s.aberta ? 'ABERTA' : hora(s.atualizada),
        tom: s.aberta ? 'ok' : 'off',
        texto: `${s.titulo} · ${haQuanto(s.atualizada)} · ${s.acoes} ações`,
      })))
    }
    return A.painel('HANDOFFS', e.handoffs.length
      ? e.handoffs.map((h) => ({ marca: new Date(h.data * 1000).toLocaleDateString('pt-BR'), tom: 'off', texto: h.titulo }))
      : [{ texto: 'Nenhum handoff registrado.' }])
  }

  A.trocarAgente = (id) => {
    const antigo = POR_ID[m.jogador.id]
    if (id !== antigo.id) {
      const pendente = m.npcs[id]?.missao
      if (pendente?.tipo === 'entrega') m.recados.push({ id, linhas: pendente.linhas, depois: pendente.depois })
      m.npcs[antigo.id] = { x: antigo.assento[0], y: antigo.assento[1], dir: 'up', resto: 0, missao: null }
      delete m.npcs[id]
      const novo = POR_ID[id]
      m.mapa = 'escritorio'
      m.jogador = { id, x: novo.assento[0], y: novo.assento[1], dir: 'down', resto: 0, giro: 0 }
      m.ultimoGatilho = ''
      m.parado = 0
      setControlado(id)
    }
    A.fechar()
  }

  A.menuTroca = () => {
    const atual = m.jogador.id
    A.abrir({
      tipo: 'menu',
      nome: 'CONTROLAR QUEM?',
      sel: Math.max(0, AGENTES.findIndex((a) => a.id === atual)),
      opcoes: AGENTES.map((a) => ({ rotulo: a.nome + (a.id === atual ? ' (VOCÊ)' : ''), fazer: () => A.trocarAgente(a.id) })),
      aoCancelar: A.fechar,
    })
  }

  A.confirmar = () => {
    const u = uiRef.current
    if (!u) return
    if (u.tipo === 'fala') {
      if (u.travada) return
      if (letrasRef.current < u.texto.length) setLetras(u.texto.length)
      else {
        som.cursor()
        u.proximo()
      }
    } else if (u.tipo === 'menu') {
      som.confirma()
      u.opcoes[u.sel].fazer()
    } else if (u.tipo === 'painel') u.aoCancelar()
  }

  // Algo novo aconteceu de verdade no Kiro: o escritório reage.
  A.eventoNovo = (v) => {
    if (v.tipo === 'rotina') {
      const nome = v.texto.match(/“(.+)”/)?.[1] || ''
      const label = Object.keys(dados.current.donos).find((l) => l.replace(CONFIG.prefixoDasRotinas || '', '').replace(/[-_]/g, ' ') === nome)
      const dono = dados.current.donos[label] || 'leodias'
      A.emote(dono, 'exclama', 6)
      A.balao(dono, `ROTINA RODOU: ${nome}`)
      return
    }
    if (!POR_ID[v.de]) return
    const n = m.npcs[v.de]
    const podeVisitar = (v.tipo === 'pediu' || v.tipo === 'delegou') && POR_ID[v.para] && v.para !== v.de
    if (podeVisitar && n && !n.missao && !m.ocupados[v.de]) n.missao = { tipo: 'visita', alvo: v.para, fase: 'indo', texto: v.texto }
    else if (podeVisitar) A.emote(v.para, 'exclama', 5)
    else {
      A.emote(v.de, 'exclama', 5)
      A.balao(v.de, v.texto)
    }
  }

  // Só no servidor de desenvolvimento: deixa os testes automáticos posicionarem o jogador e simularem eventos.
  if (import.meta.env.DEV) window.__jogo = { m, A, FOFOCAS }

  // Efeito de máquina de escrever.
  useEffect(() => {
    if (ui?.tipo !== 'fala' || letras >= ui.texto.length) return
    const t = setTimeout(() => {
      if (letras % 4 === 0) som.letra()
      setLetras((n) => n + 2)
    }, 22)
    return () => clearTimeout(t)
  }, [ui, letras])

  // Dados reais do Kiro (somente leitura) e lista de rotinas.
  useEffect(() => {
    let vivo = true
    const buscar = async () => {
      const [e, r] = DEMO ? [estadoDemo(), ROTINAS_DEMO] : await Promise.all([ler('/api/estado'), ler('/api/rotinas')])
      if (!vivo || !e.agentes) return
      dados.current = {
        estado: e,
        agentes: Object.fromEntries(e.agentes.map((a) => [a.id, a])),
        rotinas: r.agentes || {},
        donos: r.donos || {},
      }
      modoRealRef.current = !!r.executarDeVerdade
      setModoReal(!!r.executarDeVerdade)
      if (!m.vistos) m.vistos = new Set(e.eventos.map((v) => v.id))
      else
        e.eventos.forEach((v) => {
          if (!m.vistos.has(v.id)) {
            m.vistos.add(v.id)
            A.eventoNovo(v)
          }
        })
    }
    buscar()
    const t = setInterval(buscar, 10000)
    // Na demonstração o escritório alterna fofoca e movimento de exemplo.
    let vez = 0
    const fofocas = Object.values(FOFOCAS)
    const exemplo = DEMO && !new URLSearchParams(location.search).has('quieto')
      ? setInterval(() => {
          vez++
          if (vez % 2) A.cena(fofocas[((vez - 1) / 2) % fofocas.length])
          else if (!m.cena) A.eventoNovo(EVENTOS_DEMO[(vez / 2) % EVENTOS_DEMO.length])
        }, 9000)
      : null
    return () => {
      vivo = false
      clearInterval(t)
      clearInterval(exemplo)
    }
  }, [])

  // Teclado.
  useEffect(() => {
    const baixo = (ev) => {
      ligarSom()
      const u = uiRef.current
      if (u?.tipo === 'entrada') return // o campo de texto cuida das próprias teclas
      const tecla = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key
      const dir = TECLAS_DIRECAO[tecla]
      if (dir || tecla === 'Tab' || CONFIRMA.includes(tecla) || VOLTA.includes(tecla)) ev.preventDefault()
      if (aberturaRef.current) {
        if (CONFIRMA.includes(tecla)) {
          aberturaRef.current = false
          setAbertura(false)
          som.confirma()
        }
        return
      }
      if (tecla === 'm') return setMudo(alternarMudo())
      if (u) {
        if (u.tipo === 'menu' && (dir === 'up' || dir === 'down')) {
          const n = u.opcoes.length
          const novo = { ...u, sel: (u.sel + (dir === 'up' ? n - 1 : 1)) % n }
          uiRef.current = novo
          setUi(novo)
          som.cursor()
        } else if (u.tipo === 'painel' && (dir === 'up' || dir === 'down')) {
          rolagem.current?.scrollBy(0, (dir === 'up' ? -1 : 1) * 60)
        } else if (CONFIRMA.includes(tecla)) A.confirmar()
        else if (VOLTA.includes(tecla) && u.aoCancelar) {
          som.volta()
          u.aoCancelar()
        }
        return
      }
      if (dir) {
        if (!m.pilha.includes(dir)) m.pilha.push(dir)
      } else if (tecla === 'Tab') A.menuTroca()
      else if (tecla === 'Escape') A.pausa()
      else if (CONFIRMA.includes(tecla) && !ev.repeat && !m.jogador.resto) {
        const [dx, dy] = PASSOS[m.jogador.dir]
        const fx = m.jogador.x + dx
        const fy = m.jogador.y + dy
        const alvo = A.npcEm(fx, fy)
        const ch = letra(m.mapa, fx, fy)
        if (alvo) A.conversar(alvo)
        else if (OBJETOS.includes(ch) && !PASSAGENS[m.mapa]?.[ch]) A.interagir(ch, fx)
      }
    }
    const cima = (ev) => {
      const tecla = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key
      const dir = TECLAS_DIRECAO[tecla]
      if (dir) m.pilha = m.pilha.filter((d) => d !== dir)
    }
    const soltarTudo = () => (m.pilha = [])
    window.addEventListener('keydown', baixo)
    window.addEventListener('keyup', cima)
    window.addEventListener('blur', soltarTudo)
    return () => {
      window.removeEventListener('keydown', baixo)
      window.removeEventListener('keyup', cima)
      window.removeEventListener('blur', soltarTudo)
    }
  }, [])

  // Tamanho: múltiplo inteiro para os pixels ficarem nítidos.
  useEffect(() => {
    const medir = () =>
      setEscala(Math.max(2, Math.floor(Math.min((window.innerWidth - 16) / (COLUNAS * T), (window.innerHeight - 56) / (LINHAS * T)))))
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [])

  // Laço do jogo: movimento em grade e desenho.
  useEffect(() => {
    const canvas = tela.current
    const g = canvas.getContext('2d')
    const tiles = criarTiles()
    const bonecos = Object.fromEntries(AGENTES.map((a) => [a.id, criarPersonagem(a)]))
    let quadro
    let antes = performance.now()

    const ocupado = (x, y) => solido(m.mapa, x, y) || !!A.npcEm(x, y)

    const atualizarJogador = (dt) => {
      const j = m.jogador
      if (j.resto > 0) {
        j.resto = Math.max(0, j.resto - VELOCIDADE * dt)
        m.parado = 0
        return
      }
      if (uiRef.current || aberturaRef.current) return
      if (m.recados.length) {
        const r = m.recados.shift()
        som.aviso()
        A.falar(`${POR_ID[r.id].nome} (VOCÊ)`, r.linhas, () => {
          A.fechar()
          m.ocupados[r.id] = false
          r.depois?.()
        })
        return
      }
      j.giro = Math.max(0, j.giro - dt)
      const dir = m.pilha[m.pilha.length - 1]
      if (dir) {
        m.parado = 0
        if (j.dir !== dir) {
          j.dir = dir
          j.giro = 0.09
        } else if (!j.giro) {
          const [dx, dy] = PASSOS[dir]
          const passagem = PASSAGENS[m.mapa]?.[letra(m.mapa, j.x + dx, j.y + dy)]
          if (passagem) {
            m.mapa = passagem.mapa
            Object.assign(j, { x: passagem.x, y: passagem.y, dir: passagem.dir, giro: 0.2 })
            m.escuro = 1
            m.ultimoGatilho = ''
            som.porta()
          } else if (!ocupado(j.x + dx, j.y + dy)) {
            j.x += dx
            j.y += dy
            j.resto = 1
            som.passo()
          }
        }
      } else m.parado += dt
      // Parou de frente para um colega ou um objeto: abre sozinho, uma vez por parada.
      const [dx, dy] = PASSOS[j.dir]
      const fx = j.x + dx
      const fy = j.y + dy
      const alvo = A.npcEm(fx, fy)
      const ch = letra(m.mapa, fx, fy)
      const objeto = !alvo && OBJETOS.includes(ch) && !PASSAGENS[m.mapa]?.[ch] ? ch : null
      if (!alvo && !objeto) m.ultimoGatilho = ''
      else if (!j.resto && !dir && m.parado > ESPERA_MENU) {
        const chave = `${m.mapa},${j.x},${j.y},${j.dir},${alvo || objeto}`
        if (chave !== m.ultimoGatilho) {
          m.ultimoGatilho = chave
          if (alvo) A.conversar(alvo)
          else A.interagir(objeto, fx)
        }
      }
    }

    const atualizarNpcs = (dt, agora) => {
      const j = m.jogador
      const noEscritorio = m.mapa === 'escritorio'
      for (const [id, n] of Object.entries(m.npcs)) {
        if (n.resto > 0) {
          n.resto = Math.max(0, n.resto - VELOCIDADE_NPC * dt)
          continue
        }
        const ms = n.missao
        if (!ms) continue
        const bloqueado = (x, y) =>
          (noEscritorio && j.x === x && j.y === y) || Object.entries(m.npcs).some(([o, v]) => o !== id && v.x === x && v.y === y)
        const andar = (rota) => {
          const [x, y, dir] = rota[0]
          Object.assign(n, { x, y, dir, resto: 1 })
        }
        if (ms.fase === 'indo') {
          let meta
          if (ms.tipo === 'cafe') meta = (x, y) => x === CAFE[0] && y === CAFE[1]
          else if (ms.tipo === 'visita') {
            const t = m.npcs[ms.alvo] || (j.id === ms.alvo && noEscritorio ? j : null)
            if (!t) {
              ms.fase = 'voltando'
              continue
            }
            ms.olhar = [t.x, t.y]
            meta = (x, y) => Math.abs(x - t.x) + Math.abs(y - t.y) === 1
          } else if (ms.tipo === 'ir') {
            if (ms.em) meta = (x, y) => x === ms.em[0] && y === ms.em[1]
            else {
              const t = m.npcs[ms.perto]
              if (!t) {
                ms.fase = 'voltando'
                continue
              }
              ms.olhar = [t.x, t.y]
              meta = (x, y) => Math.abs(x - t.x) + Math.abs(y - t.y) === 1
            }
          } else {
            if (!noEscritorio) continue // espera você voltar da outra sala
            ms.olhar = [j.x, j.y]
            meta = (x, y) => Math.abs(x - j.x) + Math.abs(y - j.y) === 1
          }
          const rota = caminho([n.x, n.y], meta, bloqueado)
          if (rota === null) {
            ms.espera = (ms.espera || 0) + dt
            if (ms.espera > 8 && ms.tipo !== 'entrega') ms.fase = 'voltando'
            continue
          }
          if (rota.length) {
            andar(rota)
            continue
          }
          n.dir = ms.encarar || (ms.olhar ? direcaoPara(n, ms.olhar) : 'up')
          if (ms.tipo === 'ir') ms.fase = 'chegou' // fica onde está até a cena mandar voltar
          else if (ms.tipo === 'entrega') {
            if (uiRef.current || j.resto) continue
            ms.fase = 'preso'
            som.aviso()
            A.falar(POR_ID[id].nome, ms.linhas, () => {
              A.fechar()
              ms.fase = 'voltando'
              m.ocupados[id] = false
              ms.depois?.()
            })
          } else {
            ms.fase = 'ficando'
            ms.tempo = ms.tipo === 'cafe' ? 3 : 6
            if (ms.texto) A.balao(id, ms.texto, 6)
          }
        } else if (ms.fase === 'ficando') {
          ms.tempo -= dt
          if (ms.tempo <= 0) ms.fase = 'voltando'
        } else if (ms.fase === 'voltando') {
          const [ax, ay] = POR_ID[id].assento
          const rota = caminho([n.x, n.y], (x, y) => x === ax && y === ay, bloqueado)
          if (rota === null) continue // a cadeira está ocupada; espera
          if (rota.length) andar(rota)
          else {
            n.dir = 'up'
            n.missao = null
          }
        }
      }
      // Sem nada real acontecendo, de vez em quando alguém parado vai buscar um café.
      if (agora > m.proximoCafe) {
        m.proximoCafe = agora + 20000 + Math.random() * 25000
        const livres = Object.keys(m.npcs).filter(
          (id) => !m.npcs[id].missao && !m.ocupados[id] && dados.current.agentes[id]?.estado !== 'trabalhando',
        )
        if (livres.length) m.npcs[livres[Math.floor(Math.random() * livres.length)]].missao = { tipo: 'cafe', fase: 'indo' }
      }
    }

    // Toca a cena roteirizada passo a passo: andar, falar, voltar.
    const atualizarCena = (dt) => {
      const c = m.cena
      if (!c) return
      const p = c.passos[c.i]
      if (!p) {
        m.cena = null
        return
      }
      if (c.novo) {
        c.novo = false
        p.ir?.forEach(([id, alvo, encarar]) => {
          if (m.npcs[id]) m.npcs[id].missao = { tipo: 'ir', fase: 'indo', encarar, ...(typeof alvo === 'string' ? { perto: alvo } : { em: alvo }) }
        })
        if (p.fala) {
          const [id, texto] = p.fala
          const quem = m.npcs[id]
          const ouvinte = m.npcs[p.para]
          c.t = (p.t || 3.6) + 0.25
          A.balao(id, texto, p.t || 3.6)
          som.cursor()
          if (quem && ouvinte) {
            quem.dir = direcaoPara(quem, [ouvinte.x, ouvinte.y])
            ouvinte.dir = direcaoPara(ouvinte, [quem.x, quem.y])
          }
        }
        p.voltar?.forEach((id) => {
          if (m.npcs[id]) m.npcs[id].missao = { tipo: 'ir', fase: 'voltando' }
        })
        if (p.virar && m.npcs[p.virar[0]]) m.npcs[p.virar[0]].dir = p.virar[1]
      }
      let pronto = true
      if (p.ir) pronto = p.ir.every(([id]) => !m.npcs[id]?.missao || m.npcs[id].missao.fase === 'chegou')
      else if (p.fala) {
        c.t -= dt
        pronto = c.t <= 0
      }
      if (pronto) {
        c.i++
        c.novo = true
      }
    }

    const desenhar = (agora) => {
      const e = canvas.width / (COLUNAS * T)
      g.setTransform(e, 0, 0, e, 0, 0)
      g.imageSmoothingEnabled = false
      const pisca = Math.floor(agora / 260) % 2
      const estados = dados.current.agentes
      const noEscritorio = m.mapa === 'escritorio'
      const periodo = periodoDoDia()
      const mapa = MAPAS[m.mapa]
      for (let y = 0; y < LINHAS; y++)
        for (let x = 0; x < COLUNAS; x++) {
          let chave = mapa[y][x]
          if (chave === 'D') {
            const dono = AGENTES.find((a) => a.assento[0] === x && a.assento[1] === y + 1)
            const estado = estados[dono?.id]?.estado || 'parado'
            chave = estado === 'trabalhando' ? `Dtrabalhando${pisca + 1}` : `D${estado}`
          } else if (chave === 'W') chave = `W${periodo}`
          else if (chave === 'R') chave = `R${((x + y + Math.floor(agora / 400)) % 2) + 1}`
          g.drawImage(tiles[chave] || tiles['.'], x * T, y * T)
        }
      g.font = `9px ${FONTE}`
      g.textBaseline = 'top'
      g.textAlign = 'center'
      g.fillStyle = '#304878'
      LETREIROS[m.mapa].forEach(([col, texto]) => g.fillText(texto, col * T, 3))
      g.textAlign = 'left'
      if (noEscritorio) {
        const tx = TAPETE.x * T
        const ty = TAPETE.y * T
        const tw = TAPETE.largura * T
        g.fillStyle = '#202028'
        g.fillRect(tx, ty + 1, tw, T - 2)
        g.fillStyle = '#d04848'
        g.fillRect(tx + 1, ty + 2, tw - 2, T - 4)
        g.fillStyle = '#f8d870'
        g.fillRect(tx + 3, ty + 4, tw - 6, 1)
        g.fillRect(tx + 3, ty + T - 5, tw - 6, 1)
        // luz que entra pelas janelas, conforme a hora
        if (periodo !== 'noite') {
          g.fillStyle = periodo === 'dia' ? 'rgba(255,255,255,0.2)' : 'rgba(255,160,80,0.2)'
          JANELAS.forEach((col) => {
            g.fillRect(col * T, 2 * T, T, T)
            g.fillRect(col * T - 3, 3 * T, T + 6, T)
          })
        }
        // relógio de parede com a hora de verdade
        const [cx, cy] = RELOGIO
        const d = new Date()
        g.fillStyle = '#202028'
        g.fillRect(cx - 5, cy - 6, 10, 12)
        g.fillRect(cx - 6, cy - 5, 12, 10)
        g.fillStyle = '#f8f8f8'
        g.fillRect(cx - 4, cy - 5, 8, 10)
        g.fillRect(cx - 5, cy - 4, 10, 8)
        const ponteiro = (volta, tamanho, cor) => {
          const a = volta * Math.PI * 2 - Math.PI / 2
          g.strokeStyle = cor
          g.lineWidth = 1
          g.beginPath()
          g.moveTo(cx, cy)
          g.lineTo(cx + Math.cos(a) * tamanho, cy + Math.sin(a) * tamanho)
          g.stroke()
        }
        ponteiro(((d.getHours() % 12) + d.getMinutes() / 60) / 12, 2.6, '#202028')
        ponteiro(d.getMinutes() / 60, 4, '#e04040')
        // cadeiras: o assento fica por baixo de quem senta
        AGENTES.forEach((a) => g.drawImage(tiles.cadeira, a.assento[0] * T, a.assento[1] * T))
      }

      const passo = (resto, x, y) => (resto > 0.5 ? ((x + y) % 2 ? 1 : 2) : 0)
      const j = m.jogador
      const [dx, dy] = PASSOS[j.dir]
      const figuras = !noEscritorio
        ? []
        : Object.entries(m.npcs).map(([id, n]) => {
            const [nx, ny] = PASSOS[n.dir]
            return { id, px: (n.x - nx * n.resto) * T, py: (n.y - ny * n.resto) * T, dir: n.dir, quadro: passo(n.resto, n.x, n.y), sentado: !n.missao }
          })
      figuras.push({ id: j.id, px: (j.x - dx * j.resto) * T, py: (j.y - dy * j.resto) * T, dir: j.dir, quadro: passo(j.resto, j.x, j.y), jogador: true })
      figuras.sort((a, b) => a.py - b.py)
      // nomes no chão, por baixo de quem passar em cima
      figuras.forEach((f) => {
        if (f.jogador || !f.sentado) return
        const nome = POR_ID[f.id].nome
        const largura = Math.ceil(g.measureText(nome).width) + 4
        const nx = Math.min(COLUNAS * T - largura, Math.max(0, f.px + 8 - Math.floor(largura / 2)))
        g.fillStyle = 'rgba(32,32,40,0.82)'
        g.fillRect(nx, f.py + 15, largura, 8)
        g.fillStyle = '#f8f8f8'
        g.fillText(nome, nx + 2, f.py + 14)
      })
      figuras.forEach((f) => {
        const x = Math.round(f.px)
        const y = Math.round(f.py)
        if (f.jogador) {
          // base vermelha: marca quem você controla, visível em qualquer posição
          g.fillStyle = '#202028'
          g.fillRect(x + 1, y + 12, 14, 4)
          g.fillStyle = pisca ? '#f86060' : '#e04040'
          g.fillRect(x + 2, y + 13, 12, 2)
        } else {
          g.fillStyle = 'rgba(32,32,40,0.22)'
          g.fillRect(x + 3, y + 14, 10, 2)
        }
        g.drawImage(bonecos[f.id][f.dir][f.quadro], x, y - 3 - (f.quadro ? 1 : 0)) // sobe um pixel no meio do passo
        if (f.sentado && f.dir === 'up') {
          // sentado de costas: o encosto cobre o tronco; quem está trabalhando mexe as mãos no teclado
          g.drawImage(tiles.encosto, x, y)
          if (estados[f.id]?.estado === 'trabalhando') {
            const bate = Math.floor(agora / 140) % 2
            g.fillStyle = '#f8d0a8'
            g.fillRect(x + 2, y + 5 + bate, 1, 2)
            g.fillRect(x + 13, y + 6 - bate, 1, 2)
          }
        }
      })
      // de noite o escritório escurece um pouco
      if (noEscritorio && periodo === 'noite') {
        g.fillStyle = 'rgba(24,32,88,0.2)'
        g.fillRect(0, 2 * T, COLUNAS * T, (LINHAS - 2) * T)
      }

      // balõezinhos de estado
      figuras.forEach((f) => {
        const x = Math.round(f.px)
        const y = Math.round(f.py) - 3
        const em = m.emotes[f.id]
        const trabalhando = !f.jogador && estados[f.id]?.estado === 'trabalhando'
        const tipo = em && em.ate > agora ? em.tipo : trabalhando ? 'pontos' : null
        if (!tipo) return
        g.fillStyle = '#202028'
        g.fillRect(x + 11, y - 7, 10, 9)
        g.fillStyle = '#f8f8f8'
        g.fillRect(x + 12, y - 6, 8, 7)
        if (tipo === 'exclama') {
          g.fillStyle = '#e04040'
          g.fillRect(x + 15, y - 5, 2, 3)
          g.fillRect(x + 15, y - 1, 2, 1)
        } else {
          g.fillStyle = '#202028'
          const n = 1 + (Math.floor(agora / 300) % 3)
          for (let i = 0; i < n; i++) g.fillRect(x + 13 + i * 2, y - 3, 1, 1)
        }
      })
      // falas curtas sobre a cabeça (o que aconteceu de verdade no Kiro)
      figuras.forEach((f) => {
        const b = m.baloes[f.id]
        if (!b || b.ate < m.tempo) return
        const largura = Math.ceil(Math.max(...b.linhas.map((l) => g.measureText(l).width))) + 8
        const altura = b.linhas.length * 8 + 4
        const bx = Math.min(COLUNAS * T - largura - 1, Math.max(1, Math.round(f.px) + 8 - Math.floor(largura / 2)))
        const by = Math.max(1, Math.round(f.py) - 6 - altura)
        g.fillStyle = '#202028'
        g.fillRect(bx, by, largura, altura)
        g.fillStyle = '#f8f8f8'
        g.fillRect(bx + 1, by + 1, largura - 2, altura - 2)
        g.fillStyle = '#202028'
        b.linhas.forEach((l, i) => g.fillText(l, bx + 4, by + 1 + i * 8))
      })
      if (m.escuro > 0) {
        g.fillStyle = `rgba(16,16,24,${m.escuro})`
        g.fillRect(0, 0, COLUNAS * T, LINHAS * T)
      }
    }

    const laco = (agora) => {
      const dt = Math.min(0.05, (agora - antes) / 1000)
      antes = agora
      m.escuro = Math.max(0, m.escuro - dt * 3)
      m.tempo += dt * 1000
      atualizarJogador(dt)
      atualizarNpcs(dt, agora)
      atualizarCena(dt)
      desenhar(agora)
      quadro = requestAnimationFrame(laco)
    }
    quadro = requestAnimationFrame(laco)
    return () => cancelAnimationFrame(quadro)
  }, [])

  const emCima = m.jogador.y >= 8
  const largura = COLUNAS * T * escala
  const altura = LINHAS * T * escala

  return (
    <div className="jogo" style={{ '--e': escala }}>
      <div className="moldura" style={{ width: largura, height: altura }}>
        <canvas ref={tela} width={largura} height={altura} />
        {abertura ? (
          <div className="abertura">
            <div className="abertura-nome">{CONFIG.nome}</div>
            <div className="abertura-sub">{CONFIG.subtitulo}</div>
            <div className="abertura-tecla">APERTE ENTER</div>
          </div>
        ) : null}
        {ui?.tipo === 'painel' ? (
          <div className="caixa painel">
            <div className="quem">{ui.titulo}</div>
            <div className="rolagem" ref={rolagem}>
              {ui.linhas.map((l, i) => (
                <div key={i} className="linha">
                  {l.marca ? <span className={`marca marca-${l.tom}`}>{l.marca}</span> : null}
                  <span>{l.texto}</span>
                </div>
              ))}
              {!ui.linhas.length ? <div className="linha">Nada para mostrar ainda.</div> : null}
            </div>
            <div className="dica">▲▼ ROLAR · X FECHAR</div>
          </div>
        ) : null}
        {ui && ui.tipo !== 'painel' ? (
          <div className={`camada ${emCima ? 'camada-topo' : ''}`}>
            {ui.tipo === 'menu' ? (
              <div className="caixa menu">
                <div className="quem">{ui.nome}</div>
                {ui.opcoes.map((o, i) => (
                  <div
                    key={o.rotulo}
                    className={`opcao ${i === ui.sel ? 'opcao-sel' : ''}`}
                    onMouseEnter={() => {
                      const novo = { ...ui, sel: i }
                      uiRef.current = novo
                      setUi(novo)
                    }}
                    onClick={() => o.fazer()}
                  >
                    <span>{i === ui.sel ? '▶' : ''}</span>
                    {o.rotulo}
                  </div>
                ))}
              </div>
            ) : null}
            {ui.tipo === 'fala' ? (
              <div className="caixa fala" onClick={() => A.confirmar()}>
                {ui.nome ? <div className="quem">{ui.nome}</div> : null}
                {ui.texto.slice(0, letras)}
                {!ui.travada && letras >= ui.texto.length ? <span className="seta">▼</span> : null}
              </div>
            ) : null}
            {ui.tipo === 'entrada' ? (
              <form
                className="caixa fala"
                onSubmit={(ev) => {
                  ev.preventDefault()
                  ui.aoEnviar(String(new FormData(ev.currentTarget).get('pedido') || ''))
                }}
              >
                <div className="quem">{ui.nome}</div>
                {ui.pergunta}
                <input
                  name="pedido"
                  autoFocus
                  autoComplete="off"
                  maxLength={300}
                  placeholder="escreva e aperte ENTER"
                  onKeyDown={(ev) => {
                    if (ev.key === 'Escape') ui.aoCancelar()
                  }}
                />
              </form>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="rodape">
        <span className={`modo ${modoReal && !DEMO ? 'modo-real' : ''}`}>{DEMO ? 'DEMO · DADOS DE EXEMPLO' : modoReal ? 'MODO REAL' : 'SIMULAÇÃO'}</span>
        <span>VOCÊ É {POR_ID[controlado].nome}</span>
        <span>SETAS: ANDAR</span>
        <span>Z/ENTER: FALAR</span>
        <span>X/ESC: VOLTAR</span>
        <span>ESC: MENU</span>
        <span>SOM {mudo ? 'DESLIGADO' : 'LIGADO'} · MÚSICA {musica ? 'LIGADA' : 'DESLIGADA'}</span>
      </div>
    </div>
  )
}

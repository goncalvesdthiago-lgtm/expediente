import './estilo.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Cena from './Cena.jsx'
import { CORES, LUGARES, rota } from './planta.js'

const INTERVALO_DADOS = 10000
const ROTULO_ESTADO = { trabalhando: 'Trabalhando', disponivel: 'Ativo hoje', parado: 'Sem atividade' }
const ROTULO_TIPO = { pedido: 'pediu', pediu: 'pediu', delegou: 'delegou', fala: 'disse', rotina: 'rotina' }

// Falas de enfeite, usadas só quando não há nada real acontecendo.
const AMBIENTE = [
  'Alguém quer café?',
  'Vou esticar as pernas e já volto.',
  'Esse board ficou bom, hein.',
  'Me avisa quando a rotina terminar?',
  'Tá calmo hoje por aqui.',
  'Depois me mostra aquela consulta.',
]

const hora = (ts) =>
  ts ? new Date(ts * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'

function haQuanto(ts, agora) {
  if (!ts) return 'sem registro recente'
  const s = Math.max(0, agora - ts)
  if (s < 60) return 'agora há pouco'
  if (s < 3600) return `há ${Math.floor(s / 60)} min`
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`
  return `há ${Math.floor(s / 86400)} d`
}

const sortear = (lista) => lista[Math.floor(Math.random() * lista.length)]

export default function App() {
  const [estado, setEstado] = useState(null)
  const [erro, setErro] = useState('')
  const [cmds, setCmds] = useState({})
  const [selecionado, setSelecionado] = useState(null)
  const [aba, setAba] = useState('agentes')
  const [tocando, setTocando] = useState(null)
  const [relogio, setRelogio] = useState(Date.now())

  const dados = useRef(null)
  const vistos = useRef(null)
  const fila = useRef([])
  const ocupado = useRef(null)
  const ultimoFim = useRef(Date.now())
  const serie = useRef(1)

  // Busca o estado do Kiro e põe na fila o que apareceu de novo.
  useEffect(() => {
    let vivo = true
    const buscar = async () => {
      try {
        const r = await fetch('/api/estado')
        const d = await r.json()
        if (!vivo) return
        if (d.erro) throw new Error(d.erro)
        if (vistos.current === null) {
          vistos.current = new Set(d.eventos.map((e) => e.id))
        } else {
          d.eventos.forEach((e) => {
            if (!vistos.current.has(e.id)) {
              vistos.current.add(e.id)
              fila.current.push({ ...e, origem: 'aovivo' })
            }
          })
        }
        dados.current = d
        setEstado(d)
        setErro('')
      } catch (e) {
        if (vivo) setErro(String(e.message || e))
      }
    }
    buscar()
    const t = setInterval(buscar, INTERVALO_DADOS)
    return () => {
      vivo = false
      clearInterval(t)
    }
  }, [])

  const tocar = useCallback((ev) => {
    const de = LUGARES[ev.de] ? ev.de : 'kiro-vas'
    const para = ev.para && ev.para !== de && (LUGARES[ev.para] || ev.para === 'cafe') ? ev.para : null
    const id = serie.current++
    const cmd = {
      id,
      texto: ev.texto,
      origem: ev.origem,
      hora: ev.ts || 0,
      para: para === 'cafe' ? null : para,
      caminho: para ? rota(de, para) : [],
      olhar: para && para !== 'cafe' ? LUGARES[para].mesa : null,
      duracao: Math.min(8, Math.max(3.5, 2.5 + ev.texto.length / 26)),
    }
    ocupado.current = { id, desde: Date.now() }
    setCmds((c) => ({ ...c, [de]: cmd }))
    setTocando({ ...ev, de, para: cmd.para })
  }, [])

  const aoTerminar = useCallback((id) => {
    if (ocupado.current?.id === id) {
      ocupado.current = null
      ultimoFim.current = Date.now()
      setTocando(null)
    }
  }, [])

  // Diretor: uma cena por vez. Novidade real primeiro; sem novidade, reprise ou ambiente.
  useEffect(() => {
    const t = setInterval(() => {
      setRelogio(Date.now())
      const d = dados.current
      if (!d) return
      if (ocupado.current) {
        if (Date.now() - ocupado.current.desde > 45000) {
          ocupado.current = null
          ultimoFim.current = Date.now()
          setTocando(null)
        }
        return
      }
      const parado = Date.now() - ultimoFim.current
      if (fila.current.length && parado > 1500) {
        tocar(fila.current.shift())
        return
      }
      if (parado < 5000) return
      const hoje = new Date()
      hoje.setHours(0, 0, 0, 0)
      const reais = d.eventos.filter((e) => e.ts * 1000 >= hoje.getTime())
      if (reais.length && Math.random() < 0.65) {
        tocar({ ...sortear(reais.slice(-30)), origem: 'reprise' })
        return
      }
      const ids = d.agentes.map((a) => a.id)
      const de = sortear(ids)
      const sorte = Math.random()
      if (sorte < 0.4) {
        tocar({ de, para: 'cafe', texto: 'Pausa para o café.', origem: 'ambiente', ts: 0 })
      } else {
        const para = sortear(ids.filter((i) => i !== de))
        tocar({ de, para, texto: sortear(AMBIENTE), origem: 'ambiente', ts: 0 })
      }
    }, 1000)
    return () => clearInterval(t)
  }, [tocar])

  const nomes = useMemo(() => {
    const n = { voce: 'Você' }
    estado?.agentes.forEach((a) => (n[a.id] = a.nome))
    return n
  }, [estado])

  if (!estado) {
    return (
      <div className="carregando">
        {erro ? `Não consegui ler o Kiro: ${erro}` : 'Abrindo o escritório…'}
      </div>
    )
  }

  const agoraSeg = Math.floor(relogio / 1000)
  const ag = estado.agentes.find((a) => a.id === selecionado)
  const conversas = [...estado.eventos].reverse().slice(0, 7)
  const k = estado.kpis

  return (
    <div className="tela">
      <Cena
        agentes={estado.agentes}
        cmds={cmds}
        selecionado={selecionado}
        onSelecionar={setSelecionado}
        onFim={aoTerminar}
      />

      <header className="topo cartao">
        <div className="marca">
          <span className="logo" />
          Escritório Kiro
        </div>
        <div className="topo-meio">
          {k.sessoesAbertas} {k.sessoesAbertas === 1 ? 'sessão aberta' : 'sessões abertas'} no Kiro
        </div>
        <div className={`vivo ${erro ? 'vivo-erro' : ''}`}>
          <i />
          {erro ? 'sem leitura' : 'Ao vivo'} {new Date(relogio).toLocaleTimeString('pt-BR')}
        </div>
      </header>

      <section className="indicadores">
        <div className="cartao indicador">
          <small>Sessões hoje</small>
          <b>{k.sessoesHoje}</b>
        </div>
        <div className="cartao indicador">
          <small>Ações hoje</small>
          <b>{k.acoesHoje}</b>
        </div>
        <div className="cartao indicador">
          <small>Rotinas hoje</small>
          <b>{k.rotinasHoje}</b>
        </div>
        <div className="cartao indicador">
          <small>Trabalhando agora</small>
          <b>
            {k.trabalhando}
            <em> de {estado.agentes.length}</em>
          </b>
        </div>
      </section>

      {ag ? (
        <aside className="cartao detalhe">
          <button className="fechar" onClick={() => setSelecionado(null)} aria-label="Fechar">
            ×
          </button>
          <div className="detalhe-topo">
            <span className="avatar" style={{ background: CORES[ag.id] }}>
              {ag.nome[0]}
            </span>
            <div>
              <small>{ag.cargo}</small>
              <h2>{ag.nome}</h2>
            </div>
          </div>
          <span className={`selo selo-${ag.estado}`}>{ROTULO_ESTADO[ag.estado]}</span>
          <p className="tarefa">{ag.tarefa || 'Nenhuma ação registrada nos últimos dias.'}</p>
          <dl>
            <dt>Última atividade</dt>
            <dd>{haQuanto(ag.ultima, agoraSeg)}</dd>
            <dt>Ações hoje</dt>
            <dd>{ag.acoesHoje}</dd>
            <dt>Arquivo</dt>
            <dd>agents/{ag.id}</dd>
          </dl>
          {ag.descricao ? <p className="descricao">{ag.descricao}</p> : null}
          {ag.ferramentas.length ? (
            <div className="etiquetas">
              {ag.ferramentas.map((f) => (
                <span key={f}>{f}</span>
              ))}
            </div>
          ) : null}
        </aside>
      ) : null}

      <section className="cartao conversas">
        <h3>
          Conversas
          <span className="legenda">
            <i className="p-aovivo" /> ao vivo <i className="p-reprise" /> reprise <i className="p-ambiente" /> ambiente
          </span>
        </h3>
        {tocando ? (
          <div className={`agora agora-${tocando.origem}`}>
            <b>Na cena:</b> {nomes[tocando.de]}
            {tocando.para ? ` com ${nomes[tocando.para]}` : ''} · {tocando.origem === 'aovivo' ? 'ao vivo' : tocando.origem}
          </div>
        ) : null}
        <ul>
          {conversas.map((e) => (
            <li key={e.id}>
              <time>{hora(e.ts)}</time>
              <span className="ponto" style={{ background: CORES[e.de] }} />
              <div>
                <b>{nomes[e.de] || e.de}</b> {ROTULO_TIPO[e.tipo] || ''}
                {e.para ? ` a ${nomes[e.para] || e.para}` : ''}
                <p>{e.texto}</p>
              </div>
            </li>
          ))}
          {!conversas.length ? <li className="vazio">Nada registrado nos últimos dias.</li> : null}
        </ul>
      </section>

      <section className="cartao lista">
        <nav>
          {[
            ['agentes', `Agentes ${estado.agentes.length}`],
            ['sessoes', `Sessões ${estado.sessoes.length}`],
            ['rotinas', `Rotinas ${estado.rotinas.length}`],
            ['handoffs', `Handoffs ${estado.handoffs.length}`],
          ].map(([id, rotulo]) => (
            <button key={id} className={aba === id ? 'ativa' : ''} onClick={() => setAba(id)}>
              {rotulo}
            </button>
          ))}
        </nav>
        <ul>
          {aba === 'agentes' &&
            estado.agentes.map((a) => (
              <li key={a.id} className="clicavel" onClick={() => setSelecionado(a.id)}>
                <span className="ponto" style={{ background: CORES[a.id] }} />
                <div>
                  <b>{a.nome}</b>
                  <p>{a.cargo}</p>
                </div>
                <span className={`selo selo-${a.estado}`}>{ROTULO_ESTADO[a.estado]}</span>
              </li>
            ))}
          {aba === 'sessoes' &&
            estado.sessoes.slice(0, 8).map((s) => (
              <li key={s.id}>
                <div>
                  <b>{s.titulo}</b>
                  <p>
                    {nomes[s.agente]} · {haQuanto(s.atualizada, agoraSeg)} · {s.acoes} ações
                  </p>
                </div>
                {s.aberta ? <span className="selo selo-trabalhando">Aberta</span> : null}
              </li>
            ))}
          {aba === 'rotinas' &&
            estado.rotinas.slice(0, 8).map((r) => (
              <li key={r.nome}>
                <div>
                  <b>{r.nome}</b>
                  <p>rodou às {hora(r.ultima)}</p>
                </div>
                <span className={`selo selo-${r.ativa ? 'trabalhando' : 'disponivel'}`}>
                  {r.ativa ? 'Rodando' : 'Feita'}
                </span>
              </li>
            ))}
          {aba === 'handoffs' &&
            estado.handoffs.map((h) => (
              <li key={h.titulo}>
                <div>
                  <b>{h.titulo}</b>
                  <p>{new Date(h.data * 1000).toLocaleDateString('pt-BR')}</p>
                </div>
              </li>
            ))}
        </ul>
      </section>
    </div>
  )
}

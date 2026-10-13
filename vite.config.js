import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execFile, spawn } from 'node:child_process'
import { appendFileSync, closeSync, mkdirSync, openSync, readFileSync, readSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'

const aqui = (p) => fileURLToPath(new URL(p, import.meta.url))
const coletor = aqui('./coletor.py')
const HISTORICO = aqui('./dados/historico.jsonl')
const LABEL = /^[A-Za-z0-9][\w.-]{2,120}$/
const TEMPO_ANALISE = 10 * 60 * 1000
const analises = new Map()

// Relido a cada pedido: dá para mudar a configuração sem reiniciar o servidor.
const lerConfig = () => JSON.parse(readFileSync(aqui('./escritorio.config.json'), 'utf8'))
const rotinaDe = (cfg, agente, indice) => {
  const rotina = cfg.agentes.find((a) => a.id === agente)?.rotinas?.[Number(indice)]
  return rotina && LABEL.test(rotina.label) ? rotina : null
}
const limpar = (t) => t.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '').replace(/\r/g, '').trim()

const responder = (res, corpo, status = 200) => {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(corpo))
}

// Só aceita pedido vindo da própria página local (outro site aberto no navegador não dispara nada).
function pedidoLocal(req) {
  const origem = req.headers.origin
  const daqui = !origem || /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origem)
  return req.method === 'POST' && daqui && /application\/json/.test(req.headers['content-type'] || '')
}

const lerCorpo = (req) =>
  new Promise((ok) => {
    let texto = ''
    req.on('data', (c) => (texto += c))
    req.on('end', () => {
      try {
        ok(JSON.parse(texto || '{}'))
      } catch {
        ok({})
      }
    })
  })

// Últimas linhas de um arquivo de log, lendo só o fim dele.
function fimDoLog(caminho, linhas = 3) {
  try {
    const { size, mtimeMs } = statSync(caminho)
    const tam = Math.min(size, 4096)
    const buf = Buffer.alloc(tam)
    const fd = openSync(caminho, 'r')
    readSync(fd, buf, 0, tam, size - tam)
    closeSync(fd)
    const todas = limpar(buf.toString('utf8')).split('\n').map((l) => l.trim()).filter(Boolean)
    return { linhas: todas.slice(-linhas).map((l) => l.slice(0, 160)), ultima: Math.floor(mtimeMs / 1000) }
  } catch {
    return { linhas: [], ultima: 0 }
  }
}

function estadoDaRotina(label) {
  return new Promise((ok) => {
    execFile('launchctl', ['print', `gui/${process.getuid()}/${label}`], (erro, saida) => {
      if (erro) return ok({ existe: false, rodando: false, execucoes: 0, saida: null, logFim: [], ultima: 0, vpnDesligada: false })
      const pegar = (re) => saida.match(re)?.[1]
      const log = fimDoLog(pegar(/stdout path = (.+)/) || '')
      const codigo = pegar(/last exit code = (-?\d+)/)
      ok({
        existe: true,
        rodando: pegar(/^\tstate = (.+)$/m) === 'running',
        execucoes: Number(pegar(/runs = (\d+)/) || 0),
        saida: codigo === undefined ? null : Number(codigo),
        logFim: log.linhas,
        ultima: log.ultima,
        // as rotinas que dependem da VPN passam por um guarda que pula a execução quando ela está desligada
        vpnDesligada: /VPN OFF/i.test(log.linhas[log.linhas.length - 1] || ''),
      })
    })
  })
}

function historico() {
  try {
    return readFileSync(HISTORICO, 'utf8').trim().split('\n').slice(-60).map((l) => JSON.parse(l)).reverse()
  } catch {
    return []
  }
}

function estadoDoKiro() {
  return {
    name: 'estado-do-kiro',
    configureServer(server) {
      // Leitura: roda o coletor (somente leitura na pasta dos agentes) e devolve o JSON.
      server.middlewares.use('/api/estado', (_req, res) => {
        execFile('python3', [coletor], { maxBuffer: 32 * 1024 * 1024 }, (erro, saida) => {
          if (erro) return responder(res, { erro: String(erro.message) }, 500)
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.setHeader('Cache-Control', 'no-store')
          res.end(saida)
        })
      })

      server.middlewares.use('/api/rotinas', (_req, res) => {
        const cfg = lerConfig()
        const agentes = {}
        const donos = {}
        for (const a of cfg.agentes) {
          agentes[a.id] = (a.rotinas || []).map((r) => r.rotulo)
          ;(a.rotinas || []).forEach((r) => (donos[r.label] = a.id))
        }
        responder(res, { executarDeVerdade: !!cfg.executarDeVerdade, agentes, donos })
      })

      // Leitura: como está a rotina no agendador e as últimas linhas do log dela.
      server.middlewares.use('/api/rotina-estado', async (req, res) => {
        const q = new URL(req.url, 'http://x').searchParams
        const rotina = rotinaDe(lerConfig(), q.get('agente'), q.get('indice'))
        if (!rotina) return responder(res, { erro: 'rotina desconhecida' }, 400)
        responder(res, await estadoDaRotina(rotina.label))
      })

      server.middlewares.use('/api/rodar', async (req, res) => {
        if (!pedidoLocal(req)) return responder(res, { erro: 'pedido recusado' }, 403)
        const { agente, indice } = await lerCorpo(req)
        const cfg = lerConfig()
        const rotina = rotinaDe(cfg, agente, indice)
        if (!rotina) return responder(res, { erro: 'rotina desconhecida' }, 400)
        if (!cfg.executarDeVerdade) return responder(res, { modo: 'simulado', rotulo: rotina.rotulo })
        const antes = await estadoDaRotina(rotina.label)
        if (!antes.existe) return responder(res, { modo: 'real', ok: false, erro: 'Essa rotina não está no agendador do Mac.' })
        if (antes.rodando) return responder(res, { modo: 'real', ok: false, erro: 'Ela já está rodando agora.' })
        execFile('launchctl', ['kickstart', `gui/${process.getuid()}/${rotina.label}`], (erro, _s, stderr) => {
          responder(res, { modo: 'real', ok: !erro, rotulo: rotina.rotulo, execucoesAntes: antes.execucoes, erro: erro ? String(stderr || erro.message).trim() : '' })
        })
      })

      server.middlewares.use('/api/analise-estado', (req, res) => {
        const t = analises.get(new URL(req.url, 'http://x').searchParams.get('id'))
        if (!t) return responder(res, { erro: 'Perdi essa análise (o servidor do jogo reiniciou).' }, 404)
        responder(res, { feito: t.feito, ok: t.ok, motivo: t.motivo, texto: t.feito ? limpar(t.saida).replace(/^>\s?/, '') : '' })
      })

      server.middlewares.use('/api/analise', async (req, res) => {
        if (!pedidoLocal(req)) return responder(res, { erro: 'pedido recusado' }, 403)
        const { agente, pedido } = await lerCorpo(req)
        const texto = String(pedido || '').trim().slice(0, 2000)
        if (!texto) return responder(res, { erro: 'pedido vazio' }, 400)
        const cfg = lerConfig()
        if (!cfg.executarDeVerdade) return responder(res, { modo: 'simulado' })
        // Roda o Kiro em segundo plano, sem terminal. Os argumentos vão em lista: o texto digitado nunca passa por shell.
        const args = ['chat', '--no-interactive']
        if (cfg.agentes.find((a) => a.id === agente)?.perfilKiro) args.push('--agent', agente)
        args.push(texto)
        const id = String(Date.now()) + Math.random().toString(36).slice(2, 8)
        const t = { feito: false, ok: false, motivo: '', saida: '' }
        analises.set(id, t)
        const filho = spawn(`${homedir()}/.local/bin/kiro-cli`, args, { cwd: homedir(), stdio: ['ignore', 'pipe', 'pipe'] })
        const relogio = setTimeout(() => {
          t.motivo = 'tempo'
          filho.kill()
        }, TEMPO_ANALISE)
        filho.stdout.on('data', (c) => (t.saida += c))
        filho.on('error', (e) => {
          clearTimeout(relogio)
          Object.assign(t, { feito: true, ok: false, motivo: e.code === 'ENOENT' ? 'sem-kiro' : 'erro', saida: String(e.message) })
        })
        filho.on('close', (codigo) => {
          clearTimeout(relogio)
          Object.assign(t, { feito: true, ok: codigo === 0 && !t.motivo })
        })
        responder(res, { modo: 'real', id })
      })

      // Histórico do que foi pedido pelo jogo. GET lista os últimos; POST acrescenta uma linha.
      server.middlewares.use('/api/historico', async (req, res) => {
        if (req.method !== 'POST') return responder(res, { itens: historico() })
        if (!pedidoLocal(req)) return responder(res, { erro: 'pedido recusado' }, 403)
        const c = await lerCorpo(req)
        const texto = (v, n) => String(v ?? '').slice(0, n)
        const linha = {
          quando: Math.floor(Date.now() / 1000),
          agente: texto(c.agente, 40),
          tipo: c.tipo === 'analise' ? 'analise' : 'rotina',
          titulo: texto(c.titulo, 200),
          modo: texto(c.modo, 12),
          ok: !!c.ok,
          resultado: texto(c.resultado, 300),
          segundos: Number(c.segundos) || 0,
        }
        mkdirSync(aqui('./dados'), { recursive: true })
        appendFileSync(HISTORICO, JSON.stringify(linha) + '\n')
        responder(res, { ok: true })
      })
    },
  }
}

// host 127.0.0.1: o escritório só abre neste computador.
export default defineConfig({
  plugins: [react(), estadoDoKiro()],
  server: { host: '127.0.0.1', port: 5199, strictPort: false },
})

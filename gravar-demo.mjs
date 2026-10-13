// Grava um vídeo do jogo no modo demonstração (dados de exemplo; nenhuma rotina é executada).
// Uso: node gravar-demo.mjs <pasta de saída> [curto]   (o servidor precisa estar no ar: ./iniciar.sh)
// Mídia não fica no Mac: gravar numa pasta temporária e subir o vídeo aprovado para o R2.
import { spawn, execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'

const saida = process.argv[2]
if (!saida) throw new Error('informe a pasta de saída')
const URL_JOGO = 'http://127.0.0.1:5199/?demo&quieto'
const quadros = `${saida}/quadros`
rmSync(quadros, { recursive: true, force: true })
mkdirSync(quadros, { recursive: true })

const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', '--remote-debugging-port=9335', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=1304,960', `--user-data-dir=${saida}/chrome`, 'about:blank',
], { stdio: 'ignore' })
const dorme = (ms) => new Promise((r) => setTimeout(r, ms))
const VK = { Enter: 13, x: 88 }

try {
  let alvo
  for (let i = 0; i < 40 && !alvo; i++) {
    await dorme(300)
    try { alvo = (await (await fetch('http://127.0.0.1:9335/json')).json()).find((t) => t.type === 'page') } catch {}
  }
  const ws = new WebSocket(alvo.webSocketDebuggerUrl)
  await new Promise((r) => (ws.onopen = r))
  let n = 0
  const pend = new Map()
  const tempos = []
  let gravando = false
  ws.onmessage = (msg) => {
    const d = JSON.parse(msg.data)
    if (d.id && pend.has(d.id)) pend.get(d.id)(d.result)
    if (d.method === 'Runtime.exceptionThrown') console.log('ERRO JS:', d.params.exceptionDetails.exception?.description?.slice(0, 400))
    if (d.method === 'Page.screencastFrame') {
      ws.send(JSON.stringify({ id: ++n, method: 'Page.screencastFrameAck', params: { sessionId: d.params.sessionId } }))
      if (!gravando) return
      writeFileSync(`${quadros}/q${String(tempos.length).padStart(5, '0')}.jpg`, Buffer.from(d.params.data, 'base64'))
      tempos.push(d.params.metadata.timestamp)
    }
  }
  const cmd = (method, params = {}) => new Promise((r) => { pend.set(++n, r); ws.send(JSON.stringify({ id: n, method, params })) })
  const js = async (expression) => {
    const r = await cmd('Runtime.evaluate', { expression, awaitPromise: true })
    if (r.exceptionDetails) console.log('ERRO no roteiro:', r.exceptionDetails.exception?.description?.slice(0, 300))
  }
  const tecla = async (key) => {
    const base = { key, code: key, windowsVirtualKeyCode: VK[key], ...(key === 'Enter' ? { text: '\r' } : {}) }
    await cmd('Input.dispatchKeyEvent', { type: 'keyDown', ...base })
    await dorme(90)
    await cmd('Input.dispatchKeyEvent', { type: 'keyUp', ...base })
  }
  // Anda n quadros numa direção: segura a "tecla" até entrar no quadro de destino.
  const andar = (dir, qtd) => js(`new Promise((ok) => {
    const m = __jogo.m, j = m.jogador
    const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }['${dir}']
    const alvo = [j.x + d[0] * ${qtd}, j.y + d[1] * ${qtd}]
    m.pilha = ['${dir}']
    const fim = () => { m.pilha = []; clearInterval(t); clearTimeout(limite); const e = setInterval(() => { if (!j.resto) { clearInterval(e); ok() } }, 16) }
    const t = setInterval(() => { if (j.x === alvo[0] && j.y === alvo[1]) fim() }, 8)
    const limite = setTimeout(fim, ${qtd} * 450 + 1500)
  })`)
  const virar = (dir) => js(`(__jogo.m.jogador.dir = '${dir}', __jogo.m.parado = 0)`)

  await cmd('Runtime.enable'); await cmd('Page.enable')
  // área útil exata: cabe o jogo na escala 4 (1280×896) mais o rodapé
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1300, height: 960, deviceScaleFactor: 1, mobile: false })
  await cmd('Page.navigate', { url: URL_JOGO })
  await dorme(4000)
  await js('__jogo.m.proximoCafe = Infinity')
  await cmd('Page.startScreencast', { format: 'jpeg', quality: 95, everyNthFrame: 1 })
  gravando = true

  const cena = (nome) => js(`__jogo.A.cena(__jogo.FOFOCAS.${nome})`)
  const fimDaCena = () => js(`new Promise((ok) => { const t = setInterval(() => { if (!__jogo.m.cena) { clearInterval(t); ok() } }, 50); setTimeout(() => { clearInterval(t); ok() }, 40000) })`)

  if (process.argv[3] === 'curto') {
    // versão curta (para GIF): abertura e uma fofoca
    await dorme(1800)
    await tecla('Enter'); await dorme(600)
    await cena('salarios')
    await dorme(900); await virar('down')
    await fimDaCena(); await dorme(900)
  } else {
  // roteiro: três fofocas, com um pedido de rotina no meio
  await dorme(2400)                                  // tela de abertura
  await tecla('Enter'); await dorme(700)
  await cena('salarios')                             // Van Gogh conta do Leo Dias para o GitHub
  await dorme(1200); await virar('down')
  await fimDaCena(); await dorme(500)
  await cena('preferidos')                           // Jirinha e Googlinho: o Thiago tem preferido; cafezinho
  await andar('left', 3); await andar('up', 1)       // enquanto isso, Kiro pede uma rotina ao Einstein
  await dorme(2300)
  await tecla('Enter'); await dorme(1900)
  await tecla('Enter'); await dorme(2600)
  await tecla('Enter'); await dorme(300)
  await andar('down', 1); await andar('right', 5); await virar('up')
  await js(`new Promise((ok) => { const t = setInterval(() => { if (__jogo.m.npcs.einstein.missao?.fase === 'preso') { clearInterval(t); ok() } }, 50); setTimeout(() => { clearInterval(t); ok() }, 14000) })`)
  await dorme(2600); await tecla('Enter')            // "Pronto! ... terminou sem erro."
  await dorme(2600); await tecla('Enter')            // fim do log
  await virar('up')
  await fimDaCena(); await dorme(500)
  await cena('pressa')                               // Leo Dias e Drill: o Thiago quer tudo pra ontem
  await dorme(1000); await virar('down')
  await fimDaCena(); await dorme(1800)
  }

  gravando = false
  await cmd('Page.stopScreencast')
  // lista de quadros com a duração real de cada um
  const linhas = tempos.map((t, i) => `file 'quadros/q${String(i).padStart(5, '0')}.jpg'\nduration ${Math.max(0.01, (tempos[i + 1] ?? t + 0.5) - t).toFixed(3)}`)
  linhas.push(`file 'quadros/q${String(tempos.length - 1).padStart(5, '0')}.jpg'`)
  writeFileSync(`${saida}/quadros.txt`, linhas.join('\n'))
  const duracao = tempos[tempos.length - 1] - tempos[0]
  console.log(`quadros: ${tempos.length}, duração: ${duracao.toFixed(1)} s, média: ${(tempos.length / duracao).toFixed(1)} quadros/s`)
} finally {
  chrome.kill()
}
execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', `${saida}/quadros.txt`,
  '-vf', 'setpts=PTS/1.3,fps=30,scale=1300:960:flags=neighbor,format=yuv420p', '-c:v', 'libx264', '-crf', '17', '-movflags', '+faststart', `${saida}/escritorio-kiro-demo.mp4`], { cwd: saida })
console.log('vídeo:', `${saida}/escritorio-kiro-demo.mp4`)
process.exit(0)

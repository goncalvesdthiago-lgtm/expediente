// Ferramenta de conferência visual: abre o jogo no Chrome sem janela, executa um roteiro e tira prints.
// Uso: node tests/ver-tela.mjs <endereço> <pasta de saída> <passos...>
// Passos: e:ms (espera) · t:Tecla (toque) · d:texto (digita) · j:código (roda na página) · p (print)
// ATENÇÃO: use sempre o endereço com ?demo. Fora da demonstração, com o modo real ligado, "RODAR" dispara rotina de verdade.
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
const [, , url, pasta, ...roteiro] = process.argv
mkdirSync(pasta, { recursive: true })
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', '--remote-debugging-port=9336', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--hide-scrollbars', `--user-data-dir=${pasta}/chrome`, 'about:blank',
], { stdio: 'ignore' })
const dorme = (ms) => new Promise((r) => setTimeout(r, ms))
const VK = { ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Enter: 13, Tab: 9, Escape: 27, z: 90, x: 88 }
try {
  let alvo
  for (let i = 0; i < 40 && !alvo; i++) {
    await dorme(300)
    try { alvo = (await (await fetch('http://127.0.0.1:9336/json')).json()).find((t) => t.type === 'page') } catch {}
  }
  const ws = new WebSocket(alvo.webSocketDebuggerUrl)
  await new Promise((r) => (ws.onopen = r))
  let n = 0, np = 0
  const pend = new Map()
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data)
    if (d.id && pend.has(d.id)) pend.get(d.id)(d.result)
    if (d.method === 'Runtime.exceptionThrown') console.log('ERRO JS:', d.params.exceptionDetails.exception?.description?.slice(0, 500))
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') console.log('console.error:', d.params.args.map((a) => a.value || a.description).join(' ').slice(0, 400))
  }
  const cmd = (method, params = {}) => new Promise((r) => { pend.set(++n, r); ws.send(JSON.stringify({ id: n, method, params })) })
  await cmd('Runtime.enable'); await cmd('Page.enable')
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1300, height: 960, deviceScaleFactor: 1, mobile: false })
  await cmd('Page.navigate', { url })
  for (const passo of roteiro) {
    const [tipo, ...r] = passo.split(':'); const valor = r.join(':')
    if (tipo === 'e') await dorme(Number(valor))
    else if (tipo === 't') {
      const base = { key: valor, code: valor, windowsVirtualKeyCode: VK[valor], ...(valor === 'Enter' ? { text: '\r' } : {}) }
      await cmd('Input.dispatchKeyEvent', { type: 'keyDown', ...base }); await dorme(120)
      await cmd('Input.dispatchKeyEvent', { type: 'keyUp', ...base }); await dorme(300)
    } else if (tipo === 'd') await cmd('Input.insertText', { text: valor })
    else if (tipo === 'j') { const x = await cmd('Runtime.evaluate', { expression: valor, awaitPromise: true }); if (x.exceptionDetails) console.log('ERRO no roteiro:', x.exceptionDetails.exception?.description?.slice(0, 300)) }
    else if (tipo === 'p') {
      const s = await cmd('Page.captureScreenshot', { format: 'png' })
      writeFileSync(`${pasta}/tela${++np}.png`, Buffer.from(s.data, 'base64')); console.log('print', np)
    }
  }
} finally { chrome.kill() }
process.exit(0)

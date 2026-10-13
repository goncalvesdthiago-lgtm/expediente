// Efeitos sonoros curtos, gerados na hora (onda quadrada, como num portátil antigo).
let ctx = null
let mudo = false
try {
  mudo = localStorage.getItem('escritorio-mudo') === '1'
} catch {
  /* sem armazenamento: começa com som */
}

// O navegador só libera áudio depois de uma tecla ou clique; chamado no primeiro toque.
export function ligarSom() {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)()
    } catch {
      /* sem áudio neste navegador */
    }
  }
  if (ctx?.state === 'suspended') ctx.resume()
}

// Música de fundo: um laço curto, agendado um pouco à frente do relógio do áudio.
const N = { C3: 130.8, E3: 164.8, F3: 174.6, G3: 196, A3: 220, B3: 246.9, C4: 261.6, D4: 293.7, E4: 329.6, F4: 349.2, G4: 392, A4: 440, B4: 493.9, C5: 523.3, D5: 587.3, E5: 659.3, F5: 698.5, G5: 784, A5: 880 }
const MELODIA = ['C5', 'E5', 'G5', 'E5', 'A4', 'C5', 'E5', 'C5', 'F4', 'A4', 'C5', 'A4', 'G4', 'B4', 'D5', 'B4',
  'E5', 'G5', 'C5', 'G5', 'C5', 'E5', 'A5', 'E5', 'A4', 'C5', 'F5', 'C5', 'B4', 'D5', 'G5', null]
const BAIXO = ['C3', 'G3', 'A3', 'E3', 'F3', 'C4', 'G3', 'D4', 'C3', 'G3', 'A3', 'E3', 'F3', 'C4', 'G3', 'B3']
const PASSO = 0.22 // segundos por nota
let musica = false
let proxima = 0
let vez = 0
try {
  musica = localStorage.getItem('escritorio-musica') === '1'
} catch {
  /* sem armazenamento: começa sem música */
}

function nota(freq, quando, dur, tipo, volume) {
  const osc = ctx.createOscillator()
  const ganho = ctx.createGain()
  osc.type = tipo
  osc.frequency.setValueAtTime(freq, quando)
  ganho.gain.setValueAtTime(volume, quando)
  ganho.gain.exponentialRampToValueAtTime(0.0001, quando + dur)
  osc.connect(ganho).connect(ctx.destination)
  osc.start(quando)
  osc.stop(quando + dur)
}

setInterval(() => {
  if (!ctx || mudo || !musica || ctx.state !== 'running') return
  if (proxima < ctx.currentTime) proxima = ctx.currentTime + 0.05
  while (proxima < ctx.currentTime + 0.3) {
    const m = MELODIA[vez % MELODIA.length]
    if (m) nota(N[m], proxima, PASSO * 0.9, 'square', 0.014)
    if (vez % 2 === 0) nota(N[BAIXO[(vez / 2) % BAIXO.length]], proxima, PASSO * 1.8, 'triangle', 0.03)
    proxima += PASSO
    vez++
  }
}, 100)

export const temMusica = () => musica
export function alternarMusica() {
  musica = !musica
  try {
    localStorage.setItem('escritorio-musica', musica ? '1' : '0')
  } catch {
    /* preferência vale só nesta visita */
  }
  return musica
}

export const estaMudo = () => mudo
export function alternarMudo() {
  mudo = !mudo
  try {
    localStorage.setItem('escritorio-mudo', mudo ? '1' : '0')
  } catch {
    /* preferência vale só nesta visita */
  }
  return mudo
}

function bip(freq, dur, quando = 0, volume = 0.05, tipo = 'square') {
  if (!ctx || mudo) return
  const t = ctx.currentTime + quando
  const osc = ctx.createOscillator()
  const ganho = ctx.createGain()
  osc.type = tipo
  osc.frequency.setValueAtTime(freq, t)
  ganho.gain.setValueAtTime(volume, t)
  ganho.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(ganho).connect(ctx.destination)
  osc.start(t)
  osc.stop(t + dur)
}

export const som = {
  passo: () => bip(110, 0.05, 0, 0.03, 'triangle'),
  letra: () => bip(880, 0.02, 0, 0.02),
  cursor: () => bip(660, 0.04),
  confirma: () => {
    bip(660, 0.06)
    bip(990, 0.09, 0.06)
  },
  volta: () => bip(330, 0.08),
  porta: () => {
    bip(220, 0.1, 0, 0.05, 'triangle')
    bip(165, 0.16, 0.1, 0.05, 'triangle')
  },
  aviso: () => {
    bip(784, 0.09)
    bip(988, 0.09, 0.1)
    bip(1175, 0.16, 0.2)
  },
}

// Pixel art original, desenhada por código em quadros de 16×16 (estilo Game Boy Color).

import { BASE, PASSO_FRENTE, PASSO_LADO } from './sprites-dados.js'

export const T = 16
const K = '#202028'

function quadro(desenhar) {
  const c = document.createElement('canvas')
  c.width = T
  c.height = T
  const g = c.getContext('2d')
  desenhar((x, y, w, h, cor) => {
    g.fillStyle = cor
    g.fillRect(x, y, w, h)
  })
  return c
}

const piso = (r) => {
  r(0, 0, 16, 16, '#f8e8b8')
  r(0, 0, 8, 8, '#f0d898')
  r(8, 8, 8, 8, '#f0d898')
  r(0, 15, 16, 1, '#e0c080')
  r(15, 0, 1, 16, '#e0c080')
}

const pisoFrio = (r) => {
  r(0, 0, 16, 16, '#c8d8e8')
  r(0, 0, 8, 8, '#b8c8e0')
  r(8, 8, 8, 8, '#b8c8e0')
  r(0, 15, 16, 1, '#98a8c8')
  r(15, 0, 1, 16, '#98a8c8')
}

const janela = (r, vidro, brilho) => {
  r(0, 0, 16, 16, '#b8d0f8')
  for (let x = 1; x < 16; x += 4) r(x, 0, 1, 16, '#a0c0f0')
  r(0, 0, 16, 2, '#506090')
  r(1, 3, 14, 12, K)
  r(2, 4, 12, 10, '#f8f8f8')
  r(3, 5, 4, 8, vidro)
  r(9, 5, 4, 8, vidro)
  r(4, 6, 1, 3, brilho)
  r(10, 6, 1, 3, brilho)
}

const paredeBaixa = (r) => {
  r(0, 0, 16, 16, '#98b0e8')
  r(0, 0, 16, 1, '#7088c8')
  r(0, 11, 16, 1, K)
  r(0, 12, 16, 4, '#584838')
  r(0, 12, 16, 1, '#786050')
}

// Armário de servidor com luzes que piscam (dois quadros).
const servidor = (r, fase) => {
  pisoFrio(r)
  r(1, 0, 14, 16, K)
  r(2, 1, 12, 14, '#404858')
  for (let i = 0; i < 4; i++) {
    r(3, 2 + i * 3, 10, 2, '#282c38')
    r(4, 2 + i * 3, 1, 1, (i + fase) % 2 ? '#68e078' : '#205838')
    r(6, 2 + i * 3, 1, 1, (i + fase) % 3 ? '#f8d870' : '#584818')
    r(11, 3 + i * 3, 1, 1, '#58c8f8')
  }
}

// Mesa vista de frente: tampo claro e painel escuro. `lado` fecha a borda esquerda ou direita.
const mesa = (r, lado) => {
  piso(r)
  r(0, 7, 16, 9, K)
  r(0, 8, 16, 3, '#f0c080')
  r(0, 8, 16, 1, '#f8d8a0')
  r(0, 12, 16, 3, '#a86830')
  r(0, 14, 16, 1, '#784818')
  if (lado === 'esq') r(0, 7, 1, 9, K)
  else r(15, 7, 1, 9, K)
}

const monitor = (r, tela, brilho) => {
  r(2, 0, 12, 9, K)
  r(3, 1, 10, 7, '#d8d8e0')
  r(4, 2, 8, 5, tela)
  if (brilho) {
    r(5, 3, 4, 1, brilho)
    r(5, 5, 6, 1, brilho)
  }
  r(6, 9, 4, 1, '#787888')
}

export function criarTiles() {
  return {
    '.': quadro(piso),
    '#': quadro((r) => {
      r(0, 0, 16, 16, '#b8d0f8')
      for (let x = 1; x < 16; x += 4) r(x, 0, 1, 16, '#a0c0f0')
      r(0, 0, 16, 2, '#506090')
    }),
    Wdia: quadro((r) => janela(r, '#70c0f8', '#d8f0f8')),
    Wtarde: quadro((r) => janela(r, '#f8a860', '#f8d8a0')),
    Wnoite: quadro((r) => {
      janela(r, '#283868', '#485890')
      r(5, 6, 1, 1, '#f8f8d0')
      r(11, 9, 1, 1, '#f8f8d0')
    }),
    '~': quadro(paredeBaixa),
    B: quadro((r) => {
      r(0, 0, 16, 16, K)
      r(1, 1, 14, 14, '#a86830')
      const livros = ['#e04040', '#4070f8', '#f0a820', '#20a870', '#8858e0', '#f8f8f8']
      ;[2, 9].forEach((y, f) => {
        r(2, y, 12, 5, '#583010')
        for (let i = 0; i < 6; i++) r(2 + i * 2, y + (i % 3 === 0 ? 1 : 0), 2, 5 - (i % 3 === 0 ? 1 : 0), livros[(i + f * 2) % 6])
      })
    }),
    P: quadro((r) => {
      piso(r)
      r(3, 1, 10, 9, K)
      r(4, 2, 8, 7, '#38a848')
      r(5, 3, 3, 2, '#70d868')
      r(9, 5, 2, 2, '#207830')
      r(4, 10, 8, 6, K)
      r(5, 10, 6, 5, '#c86030')
      r(5, 10, 6, 1, '#e88850')
    }),
    C: quadro((r) => {
      piso(r)
      r(0, 5, 16, 11, K)
      r(1, 6, 14, 9, '#f8f8f8')
      r(1, 12, 14, 3, '#b8c0d0')
      r(3, 0, 8, 7, K)
      r(4, 1, 6, 5, '#404858')
      r(5, 2, 2, 1, '#e04040')
      r(11, 3, 3, 4, K)
      r(12, 4, 1, 2, '#f8f8f8')
    }),
    K: quadro((r) => {
      piso(r)
      r(4, 0, 8, 7, K)
      r(5, 1, 6, 5, '#70c0f8')
      r(6, 2, 1, 3, '#d8f0f8')
      r(3, 7, 10, 9, K)
      r(4, 8, 8, 7, '#f8f8f8')
      r(6, 10, 2, 2, '#4070f8')
      r(9, 10, 1, 2, '#e04040')
    }),
    d: quadro((r) => {
      mesa(r, 'dir')
      r(2, 4, 7, 6, K)
      r(3, 5, 5, 4, '#f8f8f8')
      r(4, 6, 3, 1, '#a8a8b8')
      r(10, 5, 4, 5, K)
      r(11, 6, 2, 3, '#e04040')
    }),
    Dparado: quadro((r) => {
      mesa(r, 'esq')
      monitor(r, '#303848', null)
    }),
    Ddisponivel: quadro((r) => {
      mesa(r, 'esq')
      monitor(r, '#58c8f8', '#b8f0f8')
    }),
    Dtrabalhando1: quadro((r) => {
      mesa(r, 'esq')
      monitor(r, '#205838', '#68e078')
    }),
    Dtrabalhando2: quadro((r) => {
      mesa(r, 'esq')
      monitor(r, '#205838', '#68e078')
      r(5, 4, 5, 1, '#68e078')
    }),
    Q: quadro((r) => {
      paredeBaixa(r)
      r(1, 1, 15, 10, K)
      r(2, 2, 14, 8, '#c89858')
      r(3, 3, 5, 3, '#f8f8f8')
      r(9, 3, 4, 2, '#f8d870')
      r(4, 7, 6, 2, '#f8f8f8')
      r(5, 3, 1, 1, '#e04040')
      r(10, 3, 1, 1, '#4878f8')
    }),
    q: quadro((r) => {
      paredeBaixa(r)
      r(0, 1, 15, 10, K)
      r(0, 2, 14, 8, '#c89858')
      r(1, 3, 4, 4, '#f8f8f8')
      r(7, 3, 5, 2, '#a8e0a0')
      r(7, 6, 5, 3, '#f8f8f8')
      r(2, 3, 1, 1, '#20a870')
      r(9, 6, 1, 1, '#e04040')
    }),
    T: quadro((r) => {
      paredeBaixa(r)
      r(2, 0, 12, 16, K)
      r(3, 1, 10, 15, '#8858e0')
      r(4, 2, 8, 6, '#b090f0')
      r(4, 9, 8, 6, '#6840b8')
      r(11, 9, 1, 2, '#f8d870')
    }),
    // lousa (duas metades), sofá (duas metades) e impressora
    H: quadro((r) => {
      paredeBaixa(r)
      r(1, 1, 15, 10, K)
      r(2, 2, 14, 8, '#f8f8f8')
      r(4, 4, 7, 1, '#4878f8')
      r(4, 6, 9, 1, '#e04040')
      r(4, 8, 5, 1, '#20a870')
    }),
    h: quadro((r) => {
      paredeBaixa(r)
      r(0, 1, 15, 10, K)
      r(0, 2, 14, 8, '#f8f8f8')
      r(2, 3, 1, 5, '#202028')
      r(2, 7, 9, 1, '#202028')
      r(4, 6, 2, 1, '#e04040')
      r(6, 5, 2, 1, '#e04040')
      r(8, 4, 3, 1, '#e04040')
      r(4, 11, 6, 1, '#a8b0c8')
    }),
    F: quadro((r) => {
      piso(r)
      r(0, 3, 16, 12, K)
      r(1, 4, 15, 4, '#4868c8')
      r(1, 4, 15, 1, '#6888e8')
      r(1, 8, 3, 6, '#3858b0')
      r(4, 9, 12, 5, '#5878d8')
      r(4, 13, 12, 1, '#3858b0')
    }),
    f: quadro((r) => {
      piso(r)
      r(0, 3, 16, 12, K)
      r(0, 4, 15, 4, '#4868c8')
      r(0, 4, 15, 1, '#6888e8')
      r(12, 8, 3, 6, '#3858b0')
      r(0, 9, 12, 5, '#5878d8')
      r(0, 13, 12, 1, '#3858b0')
      r(5, 9, 1, 4, '#3858b0')
    }),
    X: quadro((r) => {
      piso(r)
      r(1, 4, 14, 12, K)
      r(2, 5, 12, 5, '#d8d8e0')
      r(2, 10, 12, 5, '#a8b0c8')
      r(4, 2, 8, 4, K)
      r(5, 3, 6, 3, '#f8f8f8')
      r(4, 11, 8, 2, '#404858')
      r(11, 7, 2, 1, '#68e078')
    }),
    // cadeira: o assento vai por baixo do boneco e o encosto por cima de quem está sentado de costas
    cadeira: quadro((r) => {
      r(3, 8, 10, 6, K)
      r(4, 9, 8, 4, '#606878')
      r(7, 14, 2, 2, '#404858')
    }),
    encosto: quadro((r) => {
      r(3, 7, 10, 7, K)
      r(4, 8, 8, 5, '#7880a0')
      r(4, 8, 8, 1, '#98a0c0')
      r(7, 14, 2, 2, '#404858')
    }),
    ',': quadro(pisoFrio),
    S: quadro((r) => {
      paredeBaixa(r)
      r(1, 0, 15, 11, K)
      r(2, 1, 14, 9, '#183048')
      r(3, 2, 6, 1, '#58c8f8')
      r(3, 4, 10, 1, '#68e078')
      r(3, 6, 8, 1, '#f8d870')
      r(3, 8, 11, 1, '#58c8f8')
    }),
    s: quadro((r) => {
      paredeBaixa(r)
      r(0, 0, 15, 11, K)
      r(0, 1, 14, 9, '#183048')
      r(1, 7, 2, 2, '#68e078')
      r(4, 5, 2, 4, '#58c8f8')
      r(7, 3, 2, 6, '#f8d870')
      r(10, 2, 2, 7, '#e85898')
    }),
    R1: quadro((r) => servidor(r, 0)),
    R2: quadro((r) => servidor(r, 1)),
    '=': quadro((r) => {
      r(0, 0, 16, 16, '#404058')
      r(0, 0, 16, 1, K)
      r(0, 1, 16, 2, '#585878')
    }),
    E: quadro((r) => {
      r(0, 0, 16, 16, '#404058')
      r(0, 0, 16, 1, K)
      r(0, 1, 16, 15, '#c84040')
      for (let x = 1; x < 16; x += 4) r(x, 1, 2, 15, '#e06858')
    }),
  }
}

const comPernas = (linhas, pernas) => [...linhas.slice(0, 13), ...pernas]
const espelhar = (linhas) => linhas.map((l) => [...l].reverse().join(''))

function pintar(linhas, corDe) {
  return quadro((r) => {
    linhas.forEach((linha, y) => {
      ;[...linha.padEnd(16, '.')].slice(0, 16).forEach((ch, x) => {
        const cor = corDe(ch, x, y)
        if (cor) r(x, y, 1, 1, cor)
      })
    })
  })
}

// Clareia (f > 1) ou escurece (f < 1) uma cor #rrggbb.
function tom(cor, f) {
  const n = parseInt(cor.slice(1), 16)
  const canal = (d) => Math.max(0, Math.min(255, Math.round(((n >> d) & 255) * f)))
  return '#' + ((canal(16) << 16) | (canal(8) << 8) | canal(0)).toString(16).padStart(6, '0')
}

// Devolve os quadros de cada direção: [parado, passo A, passo B].
// `chapeu` cobre o alto da cabeça, `barba` pinta o queixo e `detalhe` é a gravata ou o botão da frente.
export function criarPersonagem({ cabelo, camisa, calca = '#383858', chapeu, barba, detalhe }) {
  const cores = { o: K, s: '#f8d0a8', e: K, c: camisa, p: calca }
  const corDe = (dir) => (ch, x, y) => {
    if (ch === 'h') {
      const base = chapeu && y <= 4 ? chapeu : cabelo
      return y <= 3 && x >= 5 && x <= 7 ? tom(base, 1.25) : x >= 11 ? tom(base, 0.82) : base // brilho no alto, sombra à direita
    }
    if (ch === 's' && barba && dir !== 'up' && y >= 7 && y <= 8) return barba
    if (ch === 'c' && detalhe && dir === 'down' && (x === 7 || x === 8) && y >= 9 && y <= 11) return detalhe
    if (ch === 'c' && x >= 11) return tom(camisa, 0.8)
    if (ch === 's' && x >= 11) return tom(cores.s, 0.9)
    return cores[ch]
  }
  const frente = (base, dir) => {
    const a = comPernas(base, PASSO_FRENTE)
    return [pintar(base, corDe(dir)), pintar(a, corDe(dir)), pintar(espelhar(a), corDe(dir))]
  }
  const lado = corDe('left')
  const ladoE = [pintar(BASE.left, lado), pintar(comPernas(BASE.left, PASSO_LADO), lado)]
  const ladoD = [pintar(espelhar(BASE.left), lado), pintar(espelhar(comPernas(BASE.left, PASSO_LADO)), lado)]
  return {
    down: frente(BASE.down, 'down'),
    up: frente(BASE.up, 'up'),
    left: [ladoE[0], ladoE[1], ladoE[1]],
    right: [ladoD[0], ladoD[1], ladoD[1]],
  }
}

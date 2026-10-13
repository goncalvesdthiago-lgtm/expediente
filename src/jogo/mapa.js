import config from '../../escritorio.config.json' with { type: 'json' }
import { AGENTES_DEMO, DEMO } from './demo.js'

// Plantas em quadros de 16 px. Cada letra é um tipo de quadro (ver sprites.js).
// Escritório: D = mesa com computador, d = resto da mesa (o agente fica logo abaixo do D),
// Qq = quadro de avisos, Hh = lousa, T = porta da sala de dados, Ff = sofá, X = impressora. Sala de dados: Ss = telão, R = servidor.

export const MAPAS = {
  escritorio: [
    '####W####W####W####W',
    '~~~~~~Qq~Hh~T~~~~~~~',
    'BB.P............PCK.',
    '....................',
    '..Dd..Dd....Dd..Dd..',
    '....................',
    '....................',
    '....................',
    '....................',
    '..Dd..Dd....Dd..Dd..',
    '....................',
    '....................',
    'P.Ff............X..P',
    '=========EE=========',
  ],
  dados: [
    '####################',
    '~~Ss~~~Ss~~~Ss~~~~~~',
    ',,,,,,,,,,,,,,,,RRR,',
    ',,,,,,,,,,,,,,,,RRR,',
    ',,,,,,,,,,,,,,,,,,,,',
    ',,,,,,,,,,,,,,,,,,,,',
    ',,,,,,,,,,,,,,,,,,,,',
    ',,,,,,,,,,,,,,,,,,,,',
    ',,,,,,,,,,,,,,,,,,,,',
    'RR,,,,,,,,,,,,,,,,,,',
    'RR,,,,,,,,,,,,,,,,,,',
    ',,,,,,,,,,,,,,,,,,,,',
    ',,,,,,,,,,,,,,,,,,,,',
    '=========EE=========',
  ],
}
export const COLUNAS = 20
export const LINHAS = 14
export const TAPETE = { x: 4, y: 7, largura: 12 }
export const CAFE = [17, 3]

// Passagens: tentar andar para dentro do quadro leva ao outro mapa.
export const PASSAGENS = {
  escritorio: { T: { mapa: 'dados', x: 9, y: 12, dir: 'up' } },
  dados: { E: { mapa: 'escritorio', x: 12, y: 2, dir: 'down' } },
}

// Letreiros pintados na parede: [coluna central, texto].
export const LETREIROS = {
  escritorio: [[7, 'AVISOS'], [12.5, 'DADOS']],
  dados: [[3, 'INDICADORES'], [8, 'SESSOES'], [13, 'HANDOFFS']],
}
export const TELOES = { 2: 'indicadores', 3: 'indicadores', 7: 'sessoes', 8: 'sessoes', 12: 'handoffs', 13: 'handoffs' }

export const RELOGIO = [272, 8] // centro do relógio de parede, em pixels de arte
export const JANELAS = [4, 9, 14, 19] // colunas das janelas do escritório

// As oito mesas do escritório, na ordem em que os agentes da configuração se sentam.
const ASSENTOS = [[2, 5], [6, 5], [12, 5], [16, 5], [2, 10], [6, 10], [12, 10], [16, 10]]
export const CONFIG = config
export const AGENTES = (DEMO ? AGENTES_DEMO : config.agentes).slice(0, ASSENTOS.length).map((a, i) => ({
  id: a.id,
  nome: a.nome.toUpperCase(),
  assento: ASSENTOS[i],
  ...a.visual,
}))

export const PASSOS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }
export const OPOSTO = { up: 'down', down: 'up', left: 'right', right: 'left' }
const DIRECOES = Object.entries(PASSOS)

export function letra(mapa, x, y) {
  if (x < 0 || y < 0 || x >= COLUNAS || y >= LINHAS) return '='
  return MAPAS[mapa][y][x]
}

export const solido = (mapa, x, y) => !'.,'.includes(letra(mapa, x, y))

// Busca em largura no escritório. Devolve a lista de passos [x, y, dir] até um quadro que
// satisfaça `ehMeta`, [] se já está lá, ou null se não há caminho.
export function caminho(inicio, ehMeta, bloqueado) {
  if (ehMeta(inicio[0], inicio[1])) return []
  const chave = (x, y) => y * COLUNAS + x
  const veioDe = new Map([[chave(...inicio), null]])
  const fila = [inicio]
  while (fila.length) {
    const [x, y] = fila.shift()
    for (const [dir, [dx, dy]] of DIRECOES) {
      const nx = x + dx
      const ny = y + dy
      const k = chave(nx, ny)
      if (veioDe.has(k) || solido('escritorio', nx, ny) || bloqueado(nx, ny)) continue
      veioDe.set(k, [x, y, dir])
      if (ehMeta(nx, ny)) {
        const passos = []
        let atual = [nx, ny]
        while (veioDe.get(chave(atual[0], atual[1]))) {
          const [px, py, d] = veioDe.get(chave(atual[0], atual[1]))
          passos.unshift([atual[0], atual[1], d])
          atual = [px, py]
        }
        return passos
      }
      fila.push([nx, ny])
    }
  }
  return null
}

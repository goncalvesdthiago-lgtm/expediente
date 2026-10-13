// Planta do escritório: onde fica cada mesa e por onde os bonecos andam.
// Duas fileiras de mesas com um corredor no meio (z = 0).

export const CORES = {
  'kiro-vas': '#2f5bea',
  einstein: '#8b5cf6',
  atlassian: '#0ea5e9',
  googlinho: '#f59e0b',
  leodias: '#ef4444',
  vangogh: '#ec4899',
  github: '#334155',
  'drill-agent': '#10b981',
  voce: '#111827',
}

const COLUNAS = [-7.5, -2.5, 2.5, 7.5]
const FILEIRAS = [
  ['kiro-vas', 'einstein', 'atlassian', 'googlinho'],
  ['leodias', 'vangogh', 'github', 'drill-agent'],
]

export const LUGARES = {}
FILEIRAS.forEach((fila, f) => {
  const lado = f === 0 ? -1 : 1
  fila.forEach((id, c) => {
    const x = COLUNAS[c]
    LUGARES[id] = {
      lado,
      mesa: [x, lado * 3.2],
      assento: [x, lado * 4.35],
      visita: [x, lado * 1.75],
      giro: lado === -1 ? 0 : Math.PI,
    }
  })
})

// "Você" fica na entrada, à esquerda, e vai até a mesa de quem recebeu o pedido.
LUGARES.voce = { lado: 0, assento: [-12.2, 0], visita: [-12.2, 0], giro: Math.PI / 2 }

export const CAFE = { balcao: [12.4, -6.4], parada: [12.0, -5.1] }

// Caminho do assento de `de` até o ponto de visita de `para` (ou até o café).
export function rota(de, para) {
  const a = LUGARES[de]
  const destino = para === 'cafe' ? CAFE.parada : LUGARES[para]?.visita
  if (!a || !destino) return []
  const pontos = []
  if (a.lado !== 0) {
    pontos.push([a.assento[0] + 1.65, a.assento[1]])
    pontos.push([a.assento[0] + 1.65, 0])
  }
  pontos.push([destino[0], 0])
  pontos.push(destino)
  return pontos
}

// Testes das partes do jogo que não dependem de tela. Rodar com: npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { AGENTES, CAFE, COLUNAS, LINHAS, MAPAS, PASSAGENS, caminho, letra, solido } from '../src/jogo/mapa.js'
import { direcaoPara, haQuanto, linhasDoHistorico, linhasDoQuadro, periodoDoDia, quebrar } from '../src/jogo/util.js'
import { FOFOCAS, AGENTES_DEMO } from '../src/jogo/demo.js'
import { BASE, PASSO_FRENTE, PASSO_LADO } from '../src/jogo/sprites-dados.js'

const config = JSON.parse(readFileSync(new URL('../escritorio.config.json', import.meta.url), 'utf8'))
const livre = () => false

test('mapas têm o tamanho certo', () => {
  for (const [nome, linhas] of Object.entries(MAPAS)) {
    assert.equal(linhas.length, LINHAS, nome)
    linhas.forEach((l, y) => assert.equal(l.length, COLUNAS, `${nome}, linha ${y}`))
  }
})

test('fora do mapa é parede', () => {
  assert.equal(solido('escritorio', -1, 3), true)
  assert.equal(solido('escritorio', COLUNAS, 3), true)
  assert.equal(solido('dados', 3, LINHAS), true)
})

test('cada agente senta num quadro livre, logo abaixo de uma mesa com computador', () => {
  assert.ok(AGENTES.length >= 1 && AGENTES.length <= 8)
  for (const a of AGENTES) {
    const [x, y] = a.assento
    assert.equal(solido('escritorio', x, y), false, a.id)
    assert.equal(letra('escritorio', x, y - 1), 'D', a.id)
  }
})

test('todo agente consegue ir até o café e até a mesa de qualquer colega', () => {
  const ocupados = (de) => (x, y) => AGENTES.some((o) => o.id !== de && o.assento[0] === x && o.assento[1] === y)
  for (const a of AGENTES) {
    assert.ok(caminho(a.assento, (x, y) => x === CAFE[0] && y === CAFE[1], ocupados(a.id)), `${a.id} até o café`)
    for (const b of AGENTES) {
      if (a === b) continue
      const perto = (x, y) => Math.abs(x - b.assento[0]) + Math.abs(y - b.assento[1]) === 1
      assert.ok(caminho(a.assento, perto, ocupados(a.id)), `${a.id} até ${b.id}`)
    }
  }
})

test('caminho: já no destino devolve vazio; sem saída devolve nulo; passos são vizinhos', () => {
  assert.deepEqual(caminho([9, 7], (x, y) => x === 9 && y === 7, livre), [])
  assert.equal(caminho([9, 7], (x, y) => x === 12 && y === 7, () => true), null)
  const rota = caminho([9, 7], (x, y) => x === 17 && y === 3, livre)
  let [px, py] = [9, 7]
  for (const [x, y] of rota) {
    assert.equal(Math.abs(x - px) + Math.abs(y - py), 1)
    assert.equal(solido('escritorio', x, y), false)
    ;[px, py] = [x, y]
  }
  assert.deepEqual([px, py], [17, 3])
})

test('passagens levam a quadros livres do outro mapa', () => {
  for (const portas of Object.values(PASSAGENS))
    for (const p of Object.values(portas)) assert.equal(solido(p.mapa, p.x, p.y), false)
})

test('configuração: ids únicos, até 8 agentes e rotinas com rótulo e label', () => {
  const ids = config.agentes.map((a) => a.id)
  assert.equal(new Set(ids).size, ids.length)
  assert.ok(ids.length <= 8)
  for (const a of config.agentes) {
    assert.ok(a.nome && a.visual?.camisa && a.visual?.cabelo, a.id)
    for (const r of a.rotinas || []) {
      assert.ok(r.rotulo, a.id)
      assert.match(r.label, /^[A-Za-z0-9][\w.-]{2,120}$/)
    }
  }
})

test('fofocas da demonstração só usam agentes da demonstração', () => {
  const ids = new Set(AGENTES_DEMO.map((a) => a.id))
  for (const [nome, passos] of Object.entries(FOFOCAS))
    for (const p of passos) {
      for (const [id] of p.ir || []) assert.ok(ids.has(id), `${nome}: ${id}`)
      if (p.fala) assert.ok(ids.has(p.fala[0]), `${nome}: ${p.fala[0]}`)
    }
})

test('desenhos dos bonecos têm 16 por 16', () => {
  for (const [dir, linhas] of Object.entries(BASE)) {
    assert.equal(linhas.length, 16, dir)
    linhas.forEach((l, y) => assert.equal(l.length, 16, `${dir}, linha ${y}`))
  }
  for (const l of [...PASSO_FRENTE, ...PASSO_LADO]) assert.equal(l.length, 16)
})

test('quebrar respeita largura e número de linhas', () => {
  const linhas = quebrar('O Leo Dias é fofoqueiro e descobriu o salário de todo mundo do escritório inteiro', 26, 2)
  assert.equal(linhas.length, 2)
  linhas.forEach((l) => assert.ok(l.length <= 26, l))
  assert.ok(linhas[1].endsWith('…'))
  assert.deepEqual(quebrar('oi', 26, 3), ['oi'])
})

test('haQuanto usa singular e plural', () => {
  const agora = 1_000_000
  assert.equal(haQuanto(0, agora), 'faz tempo')
  assert.equal(haQuanto(agora - 30, agora), 'agora há pouco')
  assert.equal(haQuanto(agora - 3600, agora), 'há 1 hora')
  assert.equal(haQuanto(agora - 2 * 86400, agora), 'há 2 dias')
})

test('direção e período do dia', () => {
  assert.equal(direcaoPara({ x: 5, y: 5 }, [9, 5]), 'right')
  assert.equal(direcaoPara({ x: 5, y: 5 }, [5, 2]), 'up')
  assert.equal(periodoDoDia(new Date(2026, 0, 1, 10)), 'dia')
  assert.equal(periodoDoDia(new Date(2026, 0, 1, 18)), 'tarde')
  assert.equal(periodoDoDia(new Date(2026, 0, 1, 23)), 'noite')
})

test('quadro de avisos põe a falha em primeiro e marca o dono', () => {
  const base = { vezesHoje: 1, intervaloMin: null, proxima: null, ultima: 100, rodouHoje: false, saida: null, rodando: false, desativada: false }
  const linhas = linhasDoQuadro(
    [
      { ...base, label: 'a', nome: 'certa', rodouHoje: true, saida: 0 },
      { ...base, label: 'b', nome: 'quebrada', rodouHoje: true, saida: 2 },
      { ...base, label: 'c', nome: 'parada', desativada: true },
    ],
    { b: 'x' },
    { x: 'EINSTEIN' },
  )
  assert.deepEqual(linhas.map((l) => l.marca), ['FALHOU', 'OK', 'DESLIGADA'])
  assert.ok(linhas[0].texto.includes('(EINSTEIN)'))
})

test('histórico separa simulado, certo e falha', () => {
  const linhas = linhasDoHistorico(
    [
      { quando: 1, agente: 'x', tipo: 'rotina', titulo: 'A', modo: 'real', ok: true },
      { quando: 1, agente: 'x', tipo: 'rotina', titulo: 'B', modo: 'real', ok: false },
      { quando: 1, agente: 'x', tipo: 'analise', titulo: 'C', modo: 'simulado', ok: true },
    ],
    { x: 'KIRO' },
  )
  assert.deepEqual(linhas.map((l) => l.marca), ['OK', 'FALHOU', 'SIMULADO'])
})

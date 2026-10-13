// Modo demonstração (?demo no endereço): dados de exemplo e nada sai do navegador.
// Serve para mostrar o jogo em público sem expor o que os agentes fazem de verdade.

export const DEMO = typeof location !== 'undefined' && new URLSearchParams(location.search).has('demo')

// Elenco da demonstração: não depende da configuração de quem está rodando.
export const AGENTES_DEMO = [
  { id: 'kiro-vas', nome: 'Kiro', visual: { cabelo: '#503018', chapeu: '#2848d8', camisa: '#4878f8' } },
  { id: 'einstein', nome: 'Einstein', visual: { cabelo: '#f0f0f8', camisa: '#f0f0f8', detalhe: '#8858e0' } },
  { id: 'atlassian', nome: 'Jirinha', visual: { cabelo: '#684020', camisa: '#2090e0', detalhe: '#f8f8f8' } },
  { id: 'googlinho', nome: 'Googlinho', visual: { cabelo: '#383840', camisa: '#f0a820', detalhe: '#4878f8' } },
  { id: 'leodias', nome: 'Leo Dias', visual: { cabelo: '#502810', camisa: '#e04040', detalhe: '#f8d870' } },
  { id: 'vangogh', nome: 'Van Gogh', visual: { cabelo: '#e87820', chapeu: '#283878', barba: '#e87820', camisa: '#e850a0' } },
  { id: 'github', nome: 'GitHub', visual: { cabelo: '#181820', chapeu: '#606878', camisa: '#606878' } },
  { id: 'drill-agent', nome: 'Drill', visual: { cabelo: '#806040', chapeu: '#f8d030', camisa: '#20a870' } },
]

const AGORA = () => Math.floor(Date.now() / 1000)
const MIN = 60

const ELENCO = [
  ['kiro-vas', 'disponivel', 4, 'Distribuir os pedidos da manhã entre o time.', 31],
  ['einstein', 'disponivel', 12, 'Conferir as vendas da semana por plano.', 18],
  ['atlassian', 'disponivel', 25, 'Atualizar o quadro da sprint.', 9],
  ['googlinho', 'disponivel', 40, 'Organizar a planilha de metas.', 7],
  ['leodias', 'disponivel', 8, 'Enviar o resumo diário para o time.', 14],
  ['vangogh', 'parado', 0, '', 0],
  ['github', 'trabalhando', 1, 'Revisar o pull request da tela de login.', 22],
  ['drill-agent', 'trabalhando', 2, 'Pesquisar concorrentes do novo plano.', 11],
]

export const ROTINAS_DEMO = {
  executarDeVerdade: false,
  agentes: {
    'kiro-vas': ['Checar a saúde das rotinas', 'Limpar tarefas antigas'],
    einstein: ['Atualizar painel de vendas', 'Relatório de retenção'],
    atlassian: ['Resumo da sprint', 'Fechar tarefas paradas'],
    googlinho: ['Organizar e-mails', 'Backup das planilhas'],
    leodias: ['Resumo diário para o time', 'Monitor do funil'],
    vangogh: ['Exportar telas do protótipo', 'Revisar contraste das cores'],
    github: ['Backup dos repositórios', 'Listar pull requests abertos'],
    'drill-agent': ['Reindexar a base de pesquisa', 'Radar de concorrentes'],
  },
  donos: {
    'demo.painel-de-vendas': 'einstein',
    'demo.resumo-diario': 'leodias',
    'demo.backup-repositorios': 'github',
    'demo.organizar-emails': 'googlinho',
    'demo.resumo-da-sprint': 'atlassian',
    'demo.reindexar-pesquisa': 'drill-agent',
    'demo.saude-das-rotinas': 'kiro-vas',
  },
}

const rotina = (label, nome, extra) => ({
  label, nome, vezesHoje: 3, intervaloMin: null, proxima: null, ultima: 0, rodouHoje: false, saida: null, rodando: false, desativada: false, ...extra,
})

export function estadoDemo() {
  const t = AGORA()
  const agentes = ELENCO.map(([id, estado, minutos, tarefa, acoesHoje]) => ({
    id, estado, tarefa, acoesHoje, ultima: minutos ? t - minutos * MIN : 0, descricao: '', ferramentas: [],
  }))
  return {
    geradoEm: t,
    agentes,
    eventos: [],
    sessoes: [
      { id: 's1', titulo: 'Quanto vendemos esta semana por plano?', agente: 'kiro-vas', atualizada: t - 4 * MIN, aberta: true, acoes: 23 },
      { id: 's2', titulo: 'Revisar o pull request da tela de login', agente: 'kiro-vas', atualizada: t - 35 * MIN, aberta: true, acoes: 41 },
      { id: 's3', titulo: 'Montar o resumo da sprint para a reunião', agente: 'kiro-vas', atualizada: t - 95 * MIN, aberta: false, acoes: 17 },
      { id: 's4', titulo: 'Pesquisar concorrentes do novo plano', agente: 'kiro-vas', atualizada: t - 180 * MIN, aberta: false, acoes: 52 },
    ],
    rotinas: [],
    handoffs: [
      { titulo: 'Análise de retenção: passar para o time de dados', data: t - 2 * 86400 },
      { titulo: 'Checklist do lançamento do novo plano', data: t - 5 * 86400 },
    ],
    quadro: [
      rotina('demo.backup-repositorios', 'backup dos repositorios', { rodouHoje: true, saida: 1, ultima: t - 50 * MIN }),
      rotina('demo.painel-de-vendas', 'painel de vendas', { rodouHoje: true, saida: 0, ultima: t - 12 * MIN, intervaloMin: 60 }),
      rotina('demo.resumo-diario', 'resumo diario', { rodouHoje: true, saida: 0, ultima: t - 130 * MIN }),
      rotina('demo.saude-das-rotinas', 'saude das rotinas', { rodouHoje: true, saida: 0, ultima: t - 6 * MIN, intervaloMin: 30 }),
      rotina('demo.organizar-emails', 'organizar e-mails', { rodouHoje: true, saida: 0, ultima: t - 75 * MIN, proxima: '18:00' }),
      rotina('demo.resumo-da-sprint', 'resumo da sprint', { proxima: '17:30' }),
      rotina('demo.reindexar-pesquisa', 'reindexar pesquisa', { proxima: '22:00' }),
      rotina('demo.relatorio-mensal', 'relatorio mensal', { desativada: true }),
    ],
    kpis: { sessoesHoje: 6, sessoesAbertas: 2, acoesHoje: 112, rotinasHoje: 5, trabalhando: 2 },
  }
}

// Movimento de exemplo, para o escritório não ficar parado na demonstração.
export const EVENTOS_DEMO = [
  { tipo: 'pediu', de: 'leodias', para: 'googlinho', texto: 'Me passa a planilha de metas para o resumo de hoje?' },
  { tipo: 'rotina', de: 'leodias', texto: 'Rotina “saude das rotinas” rodou.' },
  { tipo: 'pediu', de: 'atlassian', para: 'github', texto: 'Quais pull requests entram nesta sprint?' },
  { tipo: 'rotina', de: 'leodias', texto: 'Rotina “organizar e-mails” rodou.' },
  { tipo: 'pediu', de: 'vangogh', para: 'drill-agent', texto: 'Achou referências de tela dos concorrentes?' },
]

// Fofocas de escritório: cenas de ficção, só para a demonstração.
// Passos: ir = [[agente, 'perto de quem' ou [x, y], para onde olhar]], fala = [agente, texto] (para = com quem fala),
// voltar = quem volta para a mesa, virar = [agente, direção].
export const FOFOCAS = {
  salarios: [
    { ir: [['vangogh', 'github']] },
    { fala: ['vangogh', 'Sabia? O Leo Dias é fofoqueiro. Descobriu o salário de todo mundo!'], para: 'github' },
    { fala: ['github', 'Até o meu?! E contou pra quem?'], para: 'vangogh', t: 2.8 },
    { fala: ['vangogh', 'Pra todo mundo. Tá tudo no log.'], para: 'github', t: 3 },
    { voltar: ['vangogh'], virar: ['github', 'up'] },
  ],
  preferidos: [
    { ir: [['atlassian', 'googlinho']] },
    { fala: ['atlassian', 'O Thiago tem preferido. Tudo ele pede pro Einstein.'], para: 'googlinho' },
    { fala: ['googlinho', 'Eu organizo os e-mails dele e nem um obrigado.'], para: 'atlassian' },
    { fala: ['atlassian', 'Bora tomar um cafezinho?'], para: 'googlinho', t: 2.4 },
    { fala: ['googlinho', 'Bora!'], para: 'atlassian', t: 1.5 },
    { ir: [['atlassian', [17, 3], 'left'], ['googlinho', [16, 3], 'right']] },
    { fala: ['atlassian', 'E ele ainda posta que foi 100% feito com IA.'] },
    { fala: ['googlinho', 'Feito pela gente, né. Ele só aperta ENTER.'] },
    { voltar: ['atlassian', 'googlinho'] },
  ],
  pressa: [
    { ir: [['leodias', 'drill-agent']] },
    { fala: ['leodias', 'Fiquei sabendo que o Thiago quer tudo pra ontem.'], para: 'drill-agent' },
    { fala: ['drill-agent', 'E muda de ideia no meio da tarefa.'], para: 'leodias', t: 3 },
    { fala: ['leodias', 'Cafezinho pra eu te contar o resto?'], para: 'drill-agent', t: 3 },
    { fala: ['drill-agent', 'Só se você não espalhar.'], para: 'leodias', t: 2.6 },
    { fala: ['leodias', 'Relaxa. Já espalhei.'], para: 'drill-agent', t: 2.8 },
    { voltar: ['leodias'], virar: ['drill-agent', 'up'] },
  ],
}

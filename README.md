# Expediente

O escritório em 8-bit dos seus agentes de IA. Jogo 2D em pixel art, no estilo dos jogos de Game Boy, em que os seus agentes de IA trabalham num escritório. Você anda com um agente e, ao parar de frente para outro, abre um menu para pedir uma rotina ou uma análise. Quando ele termina, levanta e vai até você com o resultado.

![Demonstração](https://pub-1ff5bc80c05c4fc08e511a52cd890be2.r2.dev/imagens/linkedin/escritorio-kiro/demo-curta.gif)

Roda só no próprio computador (`127.0.0.1`). A arte é original e desenhada por código.

## Como abrir

Precisa de Node 20 ou mais novo e Python 3.

```bash
./iniciar.sh        # instala o que faltar e abre http://127.0.0.1:5199
```

Para só ver o jogo, sem configurar nada, abra `http://127.0.0.1:5199/?demo`: é a demonstração, com dados de exemplo, que não executa nada.

Teclas: setas andam, `Z` ou `Enter` fala, `X` ou `Esc` volta, `Esc` abre o menu, `Tab` troca o agente controlado, `M` liga e desliga o som.

## O que tem no escritório

- **Agentes nas mesas.** O monitor acende quando o agente foi usado e fica verde enquanto ele trabalha.
- **Pedidos.** Rotina ou análise pelo menu; o agente leva o resultado até você. No modo real, toda rotina pede confirmação antes de rodar.
- **Quadro de avisos.** As rotinas do dia (a que falhou fica em vermelho) e o histórico do que foi pedido pelo jogo.
- **Sala de dados.** Telões com indicadores, sessões recentes e handoffs.
- **Vida de escritório.** Janelas e relógio seguem a hora de verdade; quando algo acontece nos agentes, o boneco correspondente reage.

## Configuração

Tudo fica em `escritorio.config.json`, criado na primeira vez a partir de `escritorio.config.exemplo.json`. Esse arquivo não vai para o repositório.

| Campo | Para que serve |
|---|---|
| `nome`, `subtitulo` | Tela de abertura |
| `pastaDosAgentes` | Onde ficam as sessões e os logs (hoje o jogo sabe ler a pasta do Kiro) |
| `prefixoDasRotinas` | Começo do nome dos LaunchAgents que entram no quadro de avisos |
| `executarDeVerdade` | `false`: só simula. `true`: "RODAR" dispara a rotina e a análise chama o `kiro-cli` |
| `agentes` | Até 8. Cada um com `id`, `nome`, `cargo`, `visual` (cores), `palavras` (o que denuncia o trabalho dele), `apelidos`, `rotinas` (`rotulo` e `label`) e `perfilKiro` |

O primeiro agente da lista é o coordenador: fica com as sessões que não são de mais ninguém e é quem você controla ao abrir o jogo.

## Como funciona

- `coletor.py` lê a pasta dos agentes (somente leitura) e devolve o estado: quem trabalhou, sessões, agenda das rotinas.
- `vite.config.js` serve esse estado e recebe os pedidos do jogo. As rotinas rodam pelo `launchctl` do macOS; o histórico fica em `dados/historico.jsonl`.
- `src/jogo/` tem o jogo: mapa, sprites, sons e música, modo demonstração e a lógica.

## Testes e ferramentas

```bash
npm test                                       # mapa, caminhos, configuração e textos
node tests/ver-tela.mjs "<endereço>?demo" <pasta> e:4000 t:Enter p    # prints do jogo
node gravar-demo.mjs <pasta> [curto]           # vídeo da demonstração
```

Use sempre `?demo` nas ferramentas automáticas: fora da demonstração, com o modo real ligado, "RODAR" dispara rotina de verdade.

## Limites

- A leitura dos agentes foi feita para a pasta do Kiro; outras ferramentas pedem um coletor próprio.
- Rodar rotinas depende do `launchctl`, então o modo real só funciona no macOS.
- Qual especialista atendeu cada pedido é dedução pelas `palavras` da configuração, porque as sessões só registram o agente principal.

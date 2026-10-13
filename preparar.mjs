// Cria escritorio.config.json a partir do exemplo, se ainda não existir. Roda antes de "dev" e de "test".
import { copyFileSync, existsSync } from 'node:fs'
const aqui = (p) => new URL(p, import.meta.url)
if (!existsSync(aqui('./escritorio.config.json'))) {
  copyFileSync(aqui('./escritorio.config.exemplo.json'), aqui('./escritorio.config.json'))
  console.log('Criei escritorio.config.json a partir do exemplo. Edite esse arquivo para pôr os seus agentes e rotinas.')
}

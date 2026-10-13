import React, { Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'

// O jogo em pixel art é a tela padrão; a versão 3D antiga abre com ?3d no endereço.
const tresD = new URLSearchParams(location.search).has('3d')
const Tela = lazy(() => (tresD ? import('./versao-3d/App.jsx') : import('./jogo/Jogo.jsx')))

createRoot(document.getElementById('root')).render(
  <Suspense fallback={null}>
    <Tela />
  </Suspense>,
)

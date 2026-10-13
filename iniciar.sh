#!/bin/bash
# Abre o Expediente no navegador (só neste computador).
cd "$(dirname "$0")" || exit 1
[ -d node_modules ] || npm install
npm run dev -- --open

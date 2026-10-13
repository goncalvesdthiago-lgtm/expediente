#!/bin/bash
# Copia o projeto para a cópia limpa (../expediente-repo) e envia para o repositório PÚBLICO no GitHub.
# O projeto de trabalho fica dentro do repositório de backup, por isso o repositório próprio é uma cópia.
# A configuração de verdade (escritorio.config.json) e o histórico (dados/) nunca são copiados.
# Uso: ./publicar-repo.sh "mensagem do commit"
set -euo pipefail
cd "$(dirname "$0")"
DESTINO=../expediente-repo
[ -d "$DESTINO/.git" ] || { echo "cópia $DESTINO não existe"; exit 1; }
rsync -a --delete --exclude .git --exclude node_modules --exclude .cache --exclude dist \
  --exclude dados --exclude escritorio.config.json ./ "$DESTINO/"
cd "$DESTINO"
git add -A
if git ls-files | grep -qx -e escritorio.config.json -e 'dados/.*'; then
  echo "PARADO: a configuração real ou o histórico entraram no commit"; exit 1
fi
git diff --cached --quiet && { echo "nada mudou"; exit 0; }
git commit -q -m "${1:-Atualiza o jogo}"
GH_TOKEN=$(env -u GITHUB_TOKEN gh auth token --user goncalvesdthiago-lgtm) \
  git -c credential.helper= -c credential.helper='!gh auth git-credential' push -q
git log --oneline -1

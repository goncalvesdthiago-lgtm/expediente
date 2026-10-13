#!/usr/bin/env python3
"""Lê a pasta ~/.kiro (SOMENTE LEITURA) e imprime em JSON o estado do escritório.

Nada é escrito em ~/.kiro. O cache fica em .cache/ dentro deste projeto.
Comandos de shell das sessões servem só para classificar a ação; o texto que
vai para a tela é o propósito declarado pelo agente e a fala dele, nunca o comando.
"""
import json
import os
import re
import sys
import time
from pathlib import Path

CONFIG = json.loads((Path(__file__).parent / "escritorio.config.json").read_text(encoding="utf-8"))
KIRO = Path(os.path.expanduser(CONFIG.get("pastaDosAgentes", "~/.kiro")))
PREFIXO = CONFIG.get("prefixoDasRotinas", "com.kiro.")   # começo do nome dos LaunchAgents das rotinas
CACHE = Path(__file__).parent / ".cache" / "sessoes.json"
MAX_SESSOES = 14          # sessões recentes lidas por inteiro
JANELA_DIAS = 3           # só sessões mexidas nos últimos N dias
ATIVO_SEG = 600           # agente conta como "trabalhando" até 10 min depois da última ação
MAX_EVENTOS = 80

# Elenco (id, nome, cargo, palavras que denunciam o trabalho dele) lido de escritorio.config.json.
# O primeiro agente é o coordenador: fica com as sessões e ações que não são de mais ninguém.
ELENCO = [(a["id"], a["nome"], a.get("cargo", ""), a.get("palavras", [])) for a in CONFIG["agentes"][:8]]
IDS = [e[0] for e in ELENCO]
CHEFE = IDS[0]
APELIDOS = {a["id"]: a["id"] for a in CONFIG["agentes"]}
for _a in CONFIG["agentes"]:
    for _apelido in _a.get("apelidos", []):
        APELIDOS[_apelido] = _a["id"]


def curto(texto, n=150):
    texto = re.sub(r"\s+", " ", str(texto or "")).strip()
    texto = re.sub(r"[*`#]", "", texto)
    return texto if len(texto) <= n else texto[: n - 1].rstrip() + "…"


def classificar(nome_ferramenta, proposito, comando):
    alvo = f"{nome_ferramenta} {proposito} {comando}".lower()
    for ident, _, _, chaves in ELENCO[1:]:
        if any(c in alvo for c in chaves):
            return ident
    return None


def ler_agentes():
    fichas = {}
    for ident, nome, cargo, _ in ELENCO:
        descricao, ferramentas = "", []
        arq = KIRO / "agents" / f"{ident}.json"
        try:
            if arq.exists():
                d = json.loads(arq.read_text())
                descricao = d.get("description", "")
                ferramentas = [str(t) for t in (d.get("tools") or [])][:8]
        except Exception:
            pass
        fichas[ident] = {
            "id": ident, "nome": nome, "cargo": cargo, "descricao": curto(descricao, 220),
            "ferramentas": ferramentas, "estado": "parado", "ultima": 0, "tarefa": "",
            "acoesHoje": 0,
        }
    return fichas


def ler_sessao(base):
    """Devolve o resumo de uma sessão: título, agente e a lista de ações com hora."""
    meta = {}
    try:
        d = json.loads(base.with_suffix(".json").read_text())
        meta = {"titulo": curto(d.get("title"), 90),
                "agente": str((d.get("session_state") or {}).get("agent_name"))}
    except Exception:
        meta = {"titulo": "", "agente": "None"}
    dono = APELIDOS.get(meta["agente"], CHEFE)
    acoes, ts, passo = [], 0, 0
    try:
        with open(base.with_suffix(".jsonl")) as f:
            for linha in f:
                try:
                    o = json.loads(linha)
                except Exception:
                    continue
                dados = o.get("data") or {}
                if o.get("kind") == "Prompt":
                    try:
                        ts = int((dados.get("meta") or {}).get("timestamp") or ts)
                    except Exception:
                        pass
                    passo = 0
                    for c in dados.get("content") or []:
                        if isinstance(c, dict) and c.get("kind") == "text":
                            acoes.append({"ts": ts, "de": "voce", "para": dono, "tipo": "pedido",
                                          "texto": curto(c.get("data"))})
                    continue
                if o.get("kind") != "AssistantMessage":
                    continue
                for c in dados.get("content") or []:
                    if not isinstance(c, dict):
                        continue
                    passo += 1
                    quando = ts + passo
                    if c.get("kind") == "text" and str(c.get("data") or "").strip():
                        acoes.append({"ts": quando, "de": dono, "para": None, "tipo": "fala",
                                      "texto": curto(c.get("data"))})
                    elif c.get("kind") == "toolUse":
                        t = c.get("data") or {}
                        ent = t.get("input") or {}
                        proposito = ent.get("__tool_use_purpose") or ""
                        if t.get("name") == "subagent":
                            papel = ""
                            for est in ent.get("stages") or []:
                                papel = est.get("role") or papel
                            alvo = APELIDOS.get(papel) or classificar("", proposito, ent.get("task", "")) or IDS[-1]
                            acoes.append({"ts": quando, "de": dono, "para": alvo, "tipo": "delegou",
                                          "texto": curto(proposito or ent.get("task"))})
                            continue
                        quem = classificar(t.get("name", ""), proposito,
                                           str(ent.get("command") or ent.get("query") or "")[:400])
                        acoes.append({"ts": quando, "de": dono, "para": quem,
                                      "tipo": "pediu" if quem and quem != dono else "acao",
                                      "ferramenta": t.get("name", ""),
                                      "texto": curto(proposito) if proposito else ""})
    except FileNotFoundError:
        pass
    return {"titulo": meta["titulo"], "agente": dono, "acoes": acoes}


def sessoes_recentes():
    pasta = KIRO / "sessions" / "cli"
    limite = time.time() - JANELA_DIAS * 86400
    achadas = []
    try:
        for arq in pasta.glob("*.jsonl"):
            m = arq.stat().st_mtime
            if m >= limite:
                achadas.append((m, arq))
    except FileNotFoundError:
        return [], set()
    achadas.sort(reverse=True)
    abertas = {a.stem for a in pasta.glob("*.lock")}
    try:
        cache = json.loads(CACHE.read_text())
    except Exception:
        cache = {}
    novo, saida = {}, []
    for m, arq in achadas[:MAX_SESSOES]:
        chave = arq.stem
        guardado = cache.get(chave)
        if guardado and guardado.get("m") == m:
            res = guardado["res"]
        else:
            res = ler_sessao(arq)
        novo[chave] = {"m": m, "res": res}
        saida.append({"id": chave, "mtime": m, **res})
    try:
        CACHE.parent.mkdir(exist_ok=True)
        CACHE.write_text(json.dumps(novo))
    except Exception:
        pass
    return saida, abertas


def ler_rotinas(hoje0):
    lista = []
    try:
        for arq in (KIRO / "logs").glob("*.log"):
            if arq.name.endswith(("stderr.log",)):
                continue
            m = arq.stat().st_mtime
            if m < hoje0:
                continue
            nome = re.sub(r"[-_]stdout$", "", arq.stem).replace("_", " ").replace("-", " ")
            lista.append({"nome": nome, "ultima": int(m), "ativa": time.time() - m < 120})
    except FileNotFoundError:
        pass
    lista.sort(key=lambda r: -r["ultima"])
    return lista


def ler_handoffs():
    lista = []
    try:
        for arq in (KIRO / "handoffs").glob("*.md"):
            titulo = arq.stem.replace("_", " ").replace("-", " ")
            try:
                with open(arq) as f:
                    for linha in f:
                        if linha.startswith("#"):
                            titulo = linha.lstrip("# ").strip()
                            break
            except Exception:
                pass
            lista.append({"titulo": curto(titulo, 80), "data": int(arq.stat().st_mtime)})
    except FileNotFoundError:
        pass
    lista.sort(key=lambda h: -h["data"])
    return lista


def ler_quadro(agora, hoje0):
    """Quadro de avisos: cada rotina agendada do Kiro, quando roda hoje e como terminou a última vez."""
    import plistlib
    import subprocess
    saidas = {}
    try:
        txt = subprocess.run(["launchctl", "list"], capture_output=True, text=True, timeout=5).stdout
        for linha in txt.splitlines():
            partes = linha.split("\t")
            if len(partes) == 3 and partes[2].startswith(PREFIXO):
                saidas[partes[2]] = {"rodando": partes[0] != "-", "saida": int(partes[1]) if partes[1].lstrip("-").isdigit() else None}
    except Exception:
        pass
    lt = time.localtime(agora)
    dia_launchd = (lt.tm_wday + 1) % 7
    minuto_agora = lt.tm_hour * 60 + lt.tm_min
    quadro = []
    for arq in sorted((Path.home() / "Library" / "LaunchAgents").glob(f"{PREFIXO}*.plist*")):
        try:
            with open(arq, "rb") as f:
                d = plistlib.load(f)
        except Exception:
            continue
        label = d.get("Label") or arq.name.split(".plist")[0]
        desativada = arq.name.endswith(".disabled")
        agenda = d.get("StartCalendarInterval") or []
        if isinstance(agenda, dict):
            agenda = [agenda]
        minutos = set()
        for a in agenda:
            if "Weekday" in a and a["Weekday"] % 7 != dia_launchd:
                continue
            if "Day" in a and a["Day"] != lt.tm_mday:
                continue
            horas = [a["Hour"]] if "Hour" in a else range(24)
            for h in horas:
                minutos.add(h * 60 + a.get("Minute", 0))
        minutos = sorted(minutos)
        ultima = 0
        log = d.get("StandardOutPath")
        try:
            if log:
                ultima = int(os.stat(log).st_mtime)
        except OSError:
            pass
        futuro = [m for m in minutos if m > minuto_agora]
        fmt = lambda m: f"{m // 60:02d}:{m % 60:02d}"
        est = saidas.get(label, {})
        quadro.append({
            "label": label,
            "nome": label.replace(PREFIXO, "").replace("-", " "),
            "vezesHoje": len(minutos),
            "intervaloMin": int(d["StartInterval"] // 60) if d.get("StartInterval") else None,
            "proxima": fmt(futuro[0]) if futuro and not desativada else None,
            "ultima": ultima,
            "rodouHoje": ultima >= hoje0,
            "saida": est.get("saida"),
            "rodando": bool(est.get("rodando")),
            "desativada": desativada,
        })
    return quadro


def main():
    agora = time.time()
    lt = time.localtime(agora)
    hoje0 = time.mktime((lt.tm_year, lt.tm_mon, lt.tm_mday, 0, 0, 0, 0, 0, -1))
    agentes = ler_agentes()
    sessoes, abertas = sessoes_recentes()
    eventos, lista_sessoes = [], []

    for s in sessoes:
        # A hora das ações vem do último pedido; nunca passa da última gravação do arquivo.
        for i, a in enumerate(s["acoes"]):
            a["ts"] = int(min(a["ts"] or s["mtime"], s["mtime"]))
            trabalhadores = {a["de"], a.get("para")} - {None, "voce"}
            for ident in trabalhadores:
                ag = agentes.get(ident)
                if not ag:
                    continue
                if a["ts"] >= hoje0:
                    ag["acoesHoje"] += 1
                if a["ts"] >= ag["ultima"]:
                    ag["ultima"] = a["ts"]
                    if a["texto"]:
                        ag["tarefa"] = a["texto"]
            if a["texto"] and a["tipo"] != "acao":
                eventos.append({"id": f"{s['id'][:8]}-{i}", "ts": a["ts"], "de": a["de"],
                                "para": a.get("para"), "tipo": a["tipo"], "texto": a["texto"],
                                "sessao": s["titulo"]})
        lista_sessoes.append({"id": s["id"], "titulo": s["titulo"] or "(sem título)",
                              "agente": s["agente"], "atualizada": int(s["mtime"]),
                              "aberta": s["id"] in abertas, "acoes": len(s["acoes"])})

    rotinas = ler_rotinas(hoje0)
    leo = agentes.get("leodias") or agentes[CHEFE]
    if rotinas:
        leo["acoesHoje"] += len(rotinas)
        if rotinas[0]["ultima"] > leo["ultima"]:
            leo["ultima"] = rotinas[0]["ultima"]
            leo["tarefa"] = f"Rotina “{rotinas[0]['nome']}” rodou"
        for r in rotinas[:12]:
            eventos.append({"id": f"rot-{r['nome']}-{r['ultima']}", "ts": r["ultima"], "de": leo["id"],
                            "para": None, "tipo": "rotina", "texto": f"Rotina “{r['nome']}” rodou.",
                            "sessao": ""})

    for ag in agentes.values():
        if ag["ultima"] and agora - ag["ultima"] < ATIVO_SEG:
            ag["estado"] = "trabalhando"
        elif ag["ultima"] >= hoje0:
            ag["estado"] = "disponivel"

    eventos.sort(key=lambda e: e["ts"])
    eventos = eventos[-MAX_EVENTOS:]
    sessoes_hoje = sum(1 for s in lista_sessoes if s["atualizada"] >= hoje0)
    json.dump({
        "geradoEm": int(agora),
        "agentes": [agentes[i] for i in IDS],
        "eventos": eventos,
        "sessoes": lista_sessoes,
        "rotinas": rotinas,
        "handoffs": ler_handoffs(),
        "quadro": ler_quadro(agora, hoje0),
        "kpis": {
            "sessoesHoje": sessoes_hoje,
            "sessoesAbertas": len(abertas),
            "acoesHoje": sum(a["acoesHoje"] for a in agentes.values()),
            "rotinasHoje": len(rotinas),
            "trabalhando": sum(1 for a in agentes.values() if a["estado"] == "trabalhando"),
        },
    }, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()

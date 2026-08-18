#!/usr/bin/env python3
"""Instala o Versus no braço C do piloto RO4, logo antes de a sessão abrir.

    python3 preparar-braco-c.py --versao 0.16.3

A versão é ARGUMENTO OBRIGATÓRIO. Escolher sozinho a mais alta instalada é como se
perde homogeneidade de instrumento no meio de uma coleta — e o §3 do PILOTO.md exige
mesma versão nos dois braços, registrada nominalmente antes de começar.

Instala logo antes de começar, não antes: assim o braço roda na versão vigente e não
numa cópia velha esquecida na pasta.
"""
from __future__ import annotations

import json
import re
import shutil
import sys
from pathlib import Path

RO4 = Path(__file__).resolve().parent
BRACO_C = RO4 / "hanzi-pwa-w2"
EXT_DIR = Path.home() / ".vscode-server" / "extensions"

HOOKS = ["inject-context.js", "phase-gate.js", "loop-detector.js", "test-outcome.js",
         "truncation-check.js", "block-destructive.js", "stop-verify.js", "server.js"]
FERRAMENTAS = ["get_phase_state", "get_decisions", "get_exit_criteria", "advance_phase",
               "start_iteration", "record_decision", "update_score", "mark_exit_criterion",
               "check_safeguard", "check_all_safeguards", "check_specs_status", "init_project",
               "get_phase_guidance", "update_project_spec", "start_new_cycle"]
GERAIS = ["Read", "Write", "Edit", "Glob", "Grep", "Bash", "WebFetch", "WebSearch", "NotebookEdit"]
SPECS = ["domain", "references", "technical", "examples", "design", "models", "datasets",
         "validation", "competitors"]


def extensao(pedida: str) -> Path:
    achadas = []
    for d in EXT_DIR.glob("jasminemoreira.versus-claude-*"):
        m = re.search(r"-(\d+)\.(\d+)\.(\d+)$", d.name)
        if m and (d / "out" / "bundle" / "server.js").exists():
            achadas.append((".".join(m.groups()), d))
    if not achadas:
        raise SystemExit(f"ERRO: nenhuma extensão versus-claude com bundle em {EXT_DIR}")
    for v, d in achadas:
        if v == pedida:
            return d
    raise SystemExit(f"ERRO: versão {pedida} não instalada. "
                     f"Instaladas: {', '.join(v for v, _ in sorted(achadas))}")


def hooks(ws: Path) -> dict:
    def cmd(nome, timeout=None):
        h = {"type": "command", "command": f'node "{ws / ".versus" / nome}"'}
        if timeout:
            h["timeout"] = timeout
        return h
    return {
        "UserPromptSubmit": [{"hooks": [cmd("inject-context.js")]}],
        "PreToolUse": [
            {"matcher": "Edit|Write", "hooks": [cmd("phase-gate.js")]},
            {"matcher": "Bash", "hooks": [cmd("loop-detector.js")]},
            {"matcher": "Bash", "hooks": [cmd("block-destructive.js")]},
        ],
        "PostToolUse": [
            {"matcher": "Grep|Bash", "hooks": [cmd("truncation-check.js")]},
            {"matcher": "Bash", "hooks": [cmd("test-outcome.js")]},
        ],
        "Stop": [{"hooks": [cmd("stop-verify.js", 120)]}],
    }


def main() -> int:
    if "--versao" not in sys.argv:
        raise SystemExit("ERRO: informe --versao <x.y.z> (o §3 do PILOTO.md exige "
                         "versão única nos dois braços, registrada antes de começar).")
    versao = sys.argv[sys.argv.index("--versao") + 1]
    ws = BRACO_C

    if not (ws / "REQUISITOS.md").exists():
        raise SystemExit(f"ERRO: {ws} não parece o braço C (sem REQUISITOS.md).")
    if (ws / ".versus" / "state.json").exists():
        raise SystemExit(f"ERRO: {ws} já tem state.json — o braço já começou. "
                         f"Reinstalar por cima trocaria o instrumento no meio da coleta.")
    if list((ws / "src").glob("*")) if (ws / "src").exists() else False:
        raise SystemExit(f"ERRO: {ws}/src já tem conteúdo — o braço já começou.")

    ext = extensao(versao)
    (ws / ".versus").mkdir(parents=True, exist_ok=True)
    for f in HOOKS:
        shutil.copyfile(ext / "out" / "bundle" / f, ws / ".versus" / f)
    (ws / ".versus" / "package.json").write_text(json.dumps({"type": "commonjs"}, indent=2) + "\n")

    (ws / ".mcp.json").write_text(json.dumps({"mcpServers": {"versus-claude": {
        "type": "stdio", "command": "node",
        "args": [str(ws / ".versus" / "server.js")], "env": {},
    }}}, indent=2) + "\n", encoding="utf-8")

    (ws / ".claude").mkdir(exist_ok=True)
    (ws / ".claude" / "settings.json").write_text(json.dumps({
        "permissions": {"allow": [f"mcp__versus-claude__{t}" for t in FERRAMENTAS] + GERAIS},
        "hooks": hooks(ws),
    }, indent=2) + "\n", encoding="utf-8")

    for d in SPECS:
        (ws / "specs" / d).mkdir(parents=True, exist_ok=True)

    faltando = [f for f in HOOKS if not (ws / ".versus" / f).exists()]
    if faltando:
        raise SystemExit(f"ERRO: hooks não copiados: {', '.join(faltando)}")

    print(f"braço C preparado em {ws}  (versus-claude {versao})")
    print("  o §1 do LOG-OPERACAO.md já registra esta versão — confira antes de abrir")
    print("  abra uma conversa NOVA em hanzi-pwa-w2 e digite: start")
    return 0


if __name__ == "__main__":
    sys.exit(main())

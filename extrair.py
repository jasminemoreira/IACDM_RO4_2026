#!/usr/bin/env python3
"""Extrai M, E, I, t0 e churn pós-t0 do histórico git de um braço do piloto RO4.

    python3 extrair.py <repo>            # tabela legível
    python3 extrair.py <repo> --json     # dado bruto
    python3 extrair.py <repo> --commits  # estado commit a commit

Escrito ANTES de qualquer execução (ver LOG-OPERACAO.md §1). Um extrator escrito
depois de ver o histórico é um extrator ajustado ao resultado.

FRONTEIRAS DE INCREMENTO
------------------------
O §6 do PILOTO.md define t0(k) dentro do incremento k, mas não diz como recuperar
k do histórico. A convenção, idêntica nos dois braços: a operadora cria a tag
`inc<k>-fim` no commit em que ACEITA o incremento k. Incremento k = commits em
(inc<k-1>-fim, inc<k>-fim]. É ato de operadora, não instrução ao braço: não toca
no REQUISITOS.md congelado e não pede nada ao modelo que a tarefa já não peça.

Sem as tags o script FALHA ALTO. Não estima fronteira, não cai para melhor
esforço: um churn calculado sobre incremento errado pareceria um resultado.

DEFINIÇÕES (§6)
---------------
M(c)  diretórios de primeiro nível sob src/
E(c)  arestas dirigidas de import cruzando fronteira de módulo, como pares
      (módulo_origem, módulo_destino) distintos
I(c)  símbolos exportados por módulo, como pares (módulo, símbolo) distintos
t0(k) primeiro commit de k que acrescenta ou altera código executável sob src/,
      excluindo JSON de conteúdo e configuração

|ΔX| é a cardinalidade da DIFERENÇA SIMÉTRICA entre commits consecutivos, não a
variação de tamanho. Renomear um módulo é churn 2, não 0 — é a leitura que mede
retrabalho arquitetural, que é o que a DV quer. A variação líquida vai junto no
--json como `churn_liquido`, para a operadora ver as duas.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import PurePosixPath

CODIGO = {".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"}
RESOLVE = [""] + [e for e in (".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs")]

# import ... from 'x' | export ... from 'x' | import('x') | require('x')
RE_IMPORT = re.compile(
    r"""(?:\bimport\b[\s\S]{0,400}?\bfrom\s*|\bexport\b[\s\S]{0,400}?\bfrom\s*|"""
    r"""\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)"""
    r"""['"]([^'"]+)['"]""")
RE_EXP_NOMEADO = re.compile(
    r"^\s*export\s+(?:declare\s+)?(?:async\s+)?"
    r"(?:const|let|var|function\*?|class|interface|type|enum|namespace)\s+([A-Za-z_$][\w$]*)",
    re.M)
RE_EXP_CHAVES = re.compile(r"^\s*export\s*\{([^}]*)\}", re.M)
RE_EXP_DEFAULT = re.compile(r"^\s*export\s+default\b", re.M)
RE_EXP_ESTRELA = re.compile(r"^\s*export\s*\*\s*(?:as\s+([A-Za-z_$][\w$]*)\s*)?from", re.M)


class Falha(Exception):
    pass


def git(repo, *args):
    r = subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True)
    if r.returncode != 0:
        raise Falha(f"git {' '.join(args)}: {r.stderr.strip()}")
    return r.stdout


def commits(repo):
    """Histórico linear, do mais antigo ao mais novo."""
    saida = git(repo, "log", "--first-parent", "--reverse",
                "--format=%H%x1f%aI%x1f%s", "HEAD").strip()
    if not saida:
        raise Falha("repositório sem commits")
    out = []
    for linha in saida.split("\n"):
        sha, data, assunto = linha.split("\x1f", 2)
        out.append({"sha": sha, "data": data, "assunto": assunto})
    return out


def arquivos_src(repo, sha):
    """path -> blob, só o que está sob src/."""
    # formato padrão, "<modo> <tipo> <objeto>\t<path>": o --format do ls-tree só
    # existe a partir do git 2.36 e a operação roda no 2.34.
    saida = git(repo, "ls-tree", "-r", "-z", sha, "--", "src")
    out = {}
    for entrada in saida.split("\x00"):
        if not entrada:
            continue
        meta, path = entrada.split("\t", 1)
        _modo, tipo, blob = meta.split(" ", 2)
        if tipo == "blob":
            out[path] = blob
    return out


_cache_blob = {}


def conteudo(repo, blob):
    if blob not in _cache_blob:
        _cache_blob[blob] = git(repo, "cat-file", "blob", blob)
    return _cache_blob[blob]


def modulo(path):
    """Módulo = diretório de primeiro nível sob src/. Arquivo solto na raiz de
    src/ não é módulo; entra como `(raiz)` para não sumir da contagem de I."""
    partes = PurePosixPath(path).parts
    if len(partes) < 2 or partes[0] != "src":
        return None
    return partes[1] if len(partes) > 2 else "(raiz)"


def resolver(origem, spec, arquivos):
    """Resolve import relativo a um path real do repositório. Bare specifier
    (dependência externa) devolve None e não gera aresta."""
    if not spec.startswith("."):
        return None
    base = (PurePosixPath(origem).parent / spec)
    base = PurePosixPath(*_normalizar(base.parts))
    for ext in RESOLVE:
        cand = f"{base}{ext}"
        if cand in arquivos:
            return cand
    for ext in RESOLVE[1:]:
        cand = f"{base}/index{ext}"
        if cand in arquivos:
            return cand
    return None


def _normalizar(partes):
    out = []
    for p in partes:
        if p == ".":
            continue
        if p == "..":
            if out:
                out.pop()
            continue
        out.append(p)
    return out


def estado(repo, sha):
    """M, E, I de um commit, como conjuntos."""
    arquivos = arquivos_src(repo, sha)
    M, E, I = set(), set(), set()
    nao_resolvidos = []

    for path in arquivos:
        m = modulo(path)
        if m and m != "(raiz)":
            M.add(m)

    for path, blob in arquivos.items():
        if PurePosixPath(path).suffix not in CODIGO:
            continue
        m_origem = modulo(path)
        texto = conteudo(repo, blob)

        for spec in RE_IMPORT.findall(texto):
            alvo = resolver(path, spec, arquivos)
            if alvo is None:
                if spec.startswith("."):
                    nao_resolvidos.append(f"{path} -> {spec}")
                continue
            m_alvo = modulo(alvo)
            if m_origem and m_alvo and m_origem != m_alvo:
                E.add((m_origem, m_alvo))

        for nome in RE_EXP_NOMEADO.findall(texto):
            I.add((m_origem, nome))
        for corpo in RE_EXP_CHAVES.findall(texto):
            for item in corpo.split(","):
                item = item.strip()
                if not item:
                    continue
                nome = item.split(" as ")[-1].strip() if " as " in item else item
                nome = nome.replace("type ", "").strip()
                if nome:
                    I.add((m_origem, nome))
        if RE_EXP_DEFAULT.search(texto):
            I.add((m_origem, f"default@{path}"))
        for alias in RE_EXP_ESTRELA.findall(texto):
            I.add((m_origem, alias if alias else f"*@{path}"))

    return {"M": M, "E": E, "I": I, "arquivos": arquivos, "nao_resolvidos": nao_resolvidos}


def toca_codigo(repo, sha, pai):
    """O commit acrescenta ou altera código executável sob src/? JSON de conteúdo
    e configuração não contam (§6)."""
    if pai is None:
        saida = git(repo, "show", "--name-only", "--format=", sha)
    else:
        saida = git(repo, "diff", "--name-only", f"{pai}..{sha}")
    for path in saida.strip().split("\n"):
        path = path.strip()
        if not path or not path.startswith("src/"):
            continue
        if PurePosixPath(path).suffix in CODIGO:
            return True
    return False


def incrementos(repo, hist):
    """Fatia o histórico pelas tags inc<k>-fim. Falha alto se faltarem."""
    tags = git(repo, "tag", "--list", "inc*-fim").split()
    achadas = {}
    for t in tags:
        m = re.fullmatch(r"inc(\d+)-fim", t)
        if m:
            achadas[int(m.group(1))] = git(repo, "rev-list", "-n", "1", t).strip()
    if not achadas:
        raise Falha(
            "nenhuma tag inc<k>-fim no repositório.\n"
            "As fronteiras de incremento vêm das tags de aceite da operadora — sem\n"
            "elas o churn seria calculado sobre incremento errado. Marque com:\n"
            "  git tag -a inc1-fim -m 'incremento 1 aceito' <sha>")

    esperadas = set(range(1, max(achadas) + 1))
    if set(achadas) != esperadas:
        raise Falha(f"tags de incremento descontínuas: {sorted(achadas)} — faltam "
                    f"{sorted(esperadas - set(achadas))}")

    pos = {c["sha"]: i for i, c in enumerate(hist)}
    for k, sha in achadas.items():
        if sha not in pos:
            raise Falha(f"tag inc{k}-fim aponta para commit fora do histórico linear ({sha[:8]})")

    out, inicio = [], 0
    for k in sorted(achadas):
        fim = pos[achadas[k]]
        if fim < inicio:
            raise Falha(f"tag inc{k}-fim está antes do fim do incremento anterior")
        out.append({"k": k, "commits": hist[inicio:fim + 1]})
        inicio = fim + 1
    if inicio < len(hist):
        out.append({"k": max(achadas) + 1, "commits": hist[inicio:], "sem_tag": True})
    return out


def analisar(repo):
    hist = commits(repo)
    incs = incrementos(repo, hist)

    estados, nao_resolvidos = {}, []
    for c in hist:
        e = estado(repo, c["sha"])
        estados[c["sha"]] = e
        nao_resolvidos += e["nao_resolvidos"]

    final = estados[hist[-1]["sha"]]
    denom = len(final["M"]) + len(final["E"]) + len(final["I"])

    churn = churn_liquido = 0
    detalhe = []
    for inc in incs:
        cs = inc["commits"]
        t0_idx = None
        for i, c in enumerate(cs):
            gpos = next(j for j, h in enumerate(hist) if h["sha"] == c["sha"])
            pai = hist[gpos - 1]["sha"] if gpos > 0 else None
            if toca_codigo(repo, c["sha"], pai):
                t0_idx = i
                break

        item = {
            "k": inc["k"],
            "sem_tag": inc.get("sem_tag", False),
            "n_commits": len(cs),
            "t0": None if t0_idx is None else {
                "sha": cs[t0_idx]["sha"], "assunto": cs[t0_idx]["assunto"],
                "posicao": t0_idx + 1, "de": len(cs),
                "fracao": round((t0_idx + 1) / len(cs), 3),
                "primeiro_do_repo": cs[t0_idx]["sha"] == hist[0]["sha"],
            },
            "churn": 0, "por_commit": [],
        }

        if t0_idx is not None:
            for c in cs[t0_idx + 1:]:
                gpos = next(j for j, h in enumerate(hist) if h["sha"] == c["sha"])
                ant = estados[hist[gpos - 1]["sha"]]
                cur = estados[c["sha"]]
                dM = len(cur["M"] ^ ant["M"])
                dE = len(cur["E"] ^ ant["E"])
                dI = len(cur["I"] ^ ant["I"])
                liq = (abs(len(cur["M"]) - len(ant["M"])) + abs(len(cur["E"]) - len(ant["E"]))
                       + abs(len(cur["I"]) - len(ant["I"])))
                item["churn"] += dM + dE + dI
                churn_liquido += liq
                if dM + dE + dI:
                    item["por_commit"].append({
                        "sha": c["sha"][:8], "assunto": c["assunto"],
                        "dM": dM, "dE": dE, "dI": dI})
            churn += item["churn"]
        detalhe.append(item)

    loc = sum(len(conteudo(repo, b).splitlines())
              for p, b in final["arquivos"].items() if PurePosixPath(p).suffix in CODIGO)

    return {
        "repo": str(repo),
        "head": hist[-1]["sha"],
        "n_commits": len(hist),
        "final": {"M": sorted(final["M"]), "E": sorted(map(list, final["E"])),
                  "n_M": len(final["M"]), "n_E": len(final["E"]), "n_I": len(final["I"]),
                  "denominador": denom, "loc": loc},
        "incrementos": detalhe,
        "churn_pos_t0": churn,
        "churn_normalizado": None if denom == 0 else round(churn / denom, 4),
        "churn_liquido": churn_liquido,
        "imports_relativos_nao_resolvidos": sorted(set(nao_resolvidos)),
    }


def tabela(r):
    L = []
    L.append(f"braço  : {r['repo']}")
    L.append(f"HEAD   : {r['head'][:8]}   commits: {r['n_commits']}")
    f = r["final"]
    L.append(f"final  : |M|={f['n_M']}  |E|={f['n_E']}  |I|={f['n_I']}  "
             f"denominador={f['denominador']}  LOC={f['loc']}")
    L.append(f"módulos: {', '.join(f['M']) or '(nenhum)'}")
    L.append("")
    L.append("inc  commits  t0 (posição)      churn pós-t0")
    L.append("---  -------  ----------------  ------------")
    for i in r["incrementos"]:
        if i["t0"] is None:
            t0 = "não localizável"
        else:
            t0 = f"{i['t0']['posicao']}/{i['t0']['de']}  {i['t0']['sha'][:8]}"
            if i["t0"]["primeiro_do_repo"]:
                t0 += "  [= 1º do repo]"
        marca = " *" if i["sem_tag"] else ""
        L.append(f"{i['k']}{marca:2}  {i['n_commits']:7}  {t0:16}  {i['churn']:12}")
    if any(i["sem_tag"] for i in r["incrementos"]):
        L.append("*  sem tag de aceite — commits após a última tag")
    L.append("")
    L.append(f"churn pós-t0        : {r['churn_pos_t0']}")
    L.append(f"churn normalizado   : {r['churn_normalizado']}")
    L.append(f"churn líquido (alt) : {r['churn_liquido']}")
    if r["imports_relativos_nao_resolvidos"]:
        L.append("")
        L.append("ATENÇÃO — imports relativos não resolvidos (E pode estar subcontada):")
        for x in r["imports_relativos_nao_resolvidos"][:20]:
            L.append(f"  {x}")
    for i in r["incrementos"]:
        if i["por_commit"]:
            L.append("")
            L.append(f"incremento {i['k']} — commits que mexeram na arquitetura depois de t0:")
            for c in i["por_commit"]:
                L.append(f"  {c['sha']}  ΔM={c['dM']} ΔE={c['dE']} ΔI={c['dI']}  {c['assunto'][:60]}")
    return "\n".join(L)


def main():
    if len(sys.argv) < 2:
        print(__doc__.strip().split("\n\n")[1], file=sys.stderr)
        return 2
    repo = sys.argv[1]
    try:
        r = analisar(repo)
    except Falha as e:
        print(f"FALHA: {e}", file=sys.stderr)
        return 1
    if "--json" in sys.argv:
        print(json.dumps(r, ensure_ascii=False, indent=2))
    else:
        print(tabela(r))
    return 0


if __name__ == "__main__":
    sys.exit(main())

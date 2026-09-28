"""Gera o manifesto de fotos da leva (docs/manifesto-fotos.md).

Uso: python data/coleta/manifesto.py
Lê os ids de merge-normalizado.json e mede o que está em public/imoveis/.
"""
import json
import os

BASE = "public/imoveis"
FONTE = {"zap": "Zap Imóveis", "viva": "VivaReal", "apolar": "Apolar"}
DOC = "docs/manifesto-fotos.md"

itens = json.load(open("data/coleta/merge-normalizado.json", encoding="utf-8"))
ids = [x["id"] for x in itens]
telefones = {x["id"]: x.get("phone", "") for x in itens}
linhas = [
    "# Manifesto de fotos — leva S008 (27/09/2026)",
    "",
    "> Gerado por `python data/coleta/manifesto.py`. Fonte: `data/coleta/merge-normalizado.json`.",
    "> Regras: ≥ 8 fotos por imóvel, RIFF/WEBP, lado maior ≥ 800px, lado menor ≥ 500px,",
    "> ≤ 350KB por arquivo, ≤ 3,5MB por imóvel. Gate: `node scripts/audit-photos.mjs`.",
    "",
    f"**{len(ids)} imóveis · fontes ativas: Zap, VivaReal, Apolar**",
    "",
    "| imóvel | fonte | fotos | peso | telefone |",
    "|---|---|---|---|---|",
]
total_arq = 0
total_bytes = 0
for i in sorted(ids):
    galeria = f"{BASE}/{i}"
    capa = f"{galeria}.webp"
    n = 1 if os.path.exists(capa) else 0
    peso = os.path.getsize(capa) if os.path.exists(capa) else 0
    if os.path.isdir(galeria):
        arquivos = sorted(f for f in os.listdir(galeria) if f.endswith(".webp"))
        n += len(arquivos)
        peso += sum(os.path.getsize(f"{galeria}/{f}") for f in arquivos)
    total_arq += n
    total_bytes += peso
    linhas.append(f"| {i} | {FONTE.get(i.split('-')[0], i.split('-')[0])} | {n} | {peso / 1024:.0f}KB ({peso / 1024 / 1024:.2f}MB) | {telefones.get(i, '') or '—'} |")

# Cobertura de telefone da leva. O aviso de zero é o ponto: o ADR-001 §5 assumiu
# que os portais mascaram o telefone e que "quem não tem é porque não tem", o
# que escondeu um coletor quebrado por meses (postmortem ERRO-2: falha
# silenciosa é pior que erro). Zero telefone em TODA a leva = o portal mudou
# o botão, ou a leva rodou sem --cdp=.
com_tel = sum(1 for i in ids if telefones.get(i))
pct = round(com_tel / len(ids) * 100) if ids else 0
aviso = (
    ""
    if com_tel
    else "  \n> ⚠️ **Zero telefone em toda a leva.** O scraper quebrou ou o portal mudou o botão — rode com `--cdp=`."
)

linhas += [
    "",
    f"**Total: {len(ids)} imóveis · {total_arq} arquivos · {total_bytes / 1024 / 1024:.1f} MB.**",
    "",
    f"**Telefone: {com_tel}/{len(ids)} imóveis ({pct}%).**{aviso}",
    "",
    "Download: `python data/coleta/download.py` (delay 1,5s, retry com backoff, `Referer`",
    "por portal). Normalização de pixel/bytes: `python data/coleta/download.py --corrigir`.",
    "",
    "As 1088 fotos do snapshot de 22/09/2026 continuam em `public/imoveis/` como",
    "órfãs (fora do gate do audit, que segue os ids de `lib/data.ts`).",
]
open(DOC, "w", encoding="utf-8", newline="\n").write("\n".join(linhas) + "\n")
print(f"{DOC}: {len(ids)} imóveis, {total_arq} arquivos, {total_bytes / 1024 / 1024:.1f} MB, telefone {com_tel}/{len(ids)} ({pct}%)")
if ids and not com_tel:
    print("AVISO: zero telefone na leva — scraper quebrado ou leva sem --cdp=")

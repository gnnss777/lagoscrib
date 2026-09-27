"""Gera o manifesto de fotos da leva (docs/manifesto-fotos.md).

Uso: python data/coleta/manifesto.py
Lê os ids de merge-normalizado.json e mede o que está em public/imoveis/.
"""
import json
import os

BASE = "public/imoveis"
FONTE = {"zap": "Zap Imóveis", "viva": "VivaReal", "apolar": "Apolar"}
DOC = "docs/manifesto-fotos.md"

ids = [x["id"] for x in json.load(open("data/coleta/merge-normalizado.json", encoding="utf-8"))]
linhas = [
    "# Manifesto de fotos — leva S008 (27/09/2026)",
    "",
    "> Gerado por `python data/coleta/manifesto.py`. Fonte: `data/coleta/merge-normalizado.json`.",
    "> Regras: ≥ 8 fotos por imóvel, RIFF/WEBP, lado maior ≥ 800px, lado menor ≥ 500px,",
    "> ≤ 350KB por arquivo, ≤ 3,5MB por imóvel. Gate: `node scripts/audit-photos.mjs`.",
    "",
    f"**{len(ids)} imóveis · fontes ativas: Zap, VivaReal, Apolar**",
    "",
    "| imóvel | fonte | fotos | peso |",
    "|---|---|---|---|",
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
    linhas.append(f"| {i} | {FONTE.get(i.split('-')[0], i.split('-')[0])} | {n} | {peso / 1024:.0f}KB ({peso / 1024 / 1024:.2f}MB) |")

linhas += [
    "",
    f"**Total: {len(ids)} imóveis · {total_arq} arquivos · {total_bytes / 1024 / 1024:.1f} MB.**",
    "",
    "Download: `python data/coleta/download.py` (delay 1,5s, retry com backoff, `Referer`",
    "por portal). Normalização de pixel/bytes: `python data/coleta/download.py --corrigir`.",
    "",
    "As 1088 fotos do snapshot de 22/09/2026 continuam em `public/imoveis/` como",
    "órfãs (fora do gate do audit, que segue os ids de `lib/data.ts`).",
]
open(DOC, "w", encoding="utf-8", newline="\n").write("\n".join(linhas) + "\n")
print(f"{DOC}: {len(ids)} imóveis, {total_arq} arquivos, {total_bytes / 1024 / 1024:.1f} MB")

"""Corrige o bairro com mojibake e valida toda a base contra lib/neighborhoods.ts.

O valor quebrado entrou quando o zap-4q-l4.json foi reescrito por PowerShell
(Set-Content le como cp1252). O scraper escreve utf-8 limpo; este script é a
rede de segurança e roda como gate depois do generate.py.
"""
import json
import re
import sys

BASE = "data/coleta"
ARQUIVOS = ["lib/data.ts"] + [
    f"{BASE}/{n}.json" for n in ("zap-23q-l4", "viva-23q-l4", "apolar-23q-l4", "zap-4q-l4")
]

spec = open("lib/neighborhoods.ts", encoding="utf-8").read()
conhecidos = set()
for _reg, corpo in re.findall(r'regional:\s*"([^"]+)",\s*neighborhoods:\s*\[(.*?)\]', spec, re.S):
    conhecidos |= set(re.findall(r'"([^"]+)"', corpo))
alias = re.search(r"MARKET_ALIAS_REGULAR|MARKET_ALIAS_REGIONAL", spec)
if alias:
    conhecidos |= set(re.findall(r'"([^"]+)":', spec[alias.start() :]))

# 1. corrige o mojibake (byteslatin1 reinterpretados como utf-8 -> volta)
for p in ARQUIVOS:
    cru = open(p, "rb").read()
    txt = cru.decode("utf-8", errors="replace")
    corrigido = txt.replace("Ã\x81", "Á").replace("Ãª", "ê").replace("Ã£", "ã")
    if corrigido != txt:
        open(p, "w", encoding="utf-8", newline="").write(corrigido)
        print(f"corrigido mojibake em {p}")

# 2. valida: todo bairro da base existe na lista de 75
problemas = []
for p in ARQUIVOS:
    if not p.endswith(".json"):
        continue
    bruto = json.load(open(p, encoding="utf-8"))
    itens = bruto["imoveis"] if isinstance(bruto, dict) else bruto
    for x in itens:
        n = x.get("neighborhood", "")
        if n not in conhecidos:
            problemas.append(f"{p}: {x['id']} -> {n!r}")

ts = open("lib/data.ts", encoding="utf-8").read()
for m in re.finditer(r'id:\s*"([^"]+)",[\s\S]{0,400}?neighborhood:\s*"([^"]+)"', ts):
    if m.group(2) not in conhecidos:
        problemas.append(f"lib/data.ts: {m.group(1)} -> {m.group(2)!r}")

if problemas:
    print("BAIRROS FORA DA LISTA:")
    for p in problemas:
        print("  " + p)
    sys.exit(1)
print(f"bairros: todos os {len(conhecidos)} conhecidos; base validada")

import re

src = open("lib/data.ts", encoding="utf-8").read()
ns = sorted(set(re.findall(r'neighborhood:\s*"([^"]+)"', src)))

# Mapa extraído de lib/neighborhoods.ts (grupos inline + multilinha + alias).
import importlib.util

spec_src = open("lib/neighborhoods.ts", encoding="utf-8").read()
groups = re.findall(r'regional:\s*"([^"]+)",\s*neighborhoods:\s*\[(.*?)\]', spec_src, re.S)
gn = {}
for reg, body in groups:
    for b in re.findall(r'"([^"]+)"', body):
        gn[b] = reg
gn["Ecoville"] = "Santa Felicidade"
gn["Cidade Industrial"] = "CIC"

from collections import Counter

c = Counter(gn.get(n, "??DESCONHECIDO??") for n in ns)
print("bairros distintos:", len(ns))
for reg, n in sorted(c.items()):
    print(f"  {reg}: {n}")
print("regionais cobertas:", len([r for r in c if not r.startswith("??")]))

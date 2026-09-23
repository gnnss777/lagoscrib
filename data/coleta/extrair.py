import json, sys
from collections import Counter

path = sys.argv[1]
out = sys.argv[2]
raw = open(path, encoding="utf-8").read()

# Extrai blocos ```json ... ``` por split simples (sem regex).
# Se não houver blocos (JSON puro), tenta o arquivo inteiro.
# NUNCA sobrescreve a saída com resultado vazio (proteção anti-apagão).
parts = raw.split("```json")
data = {"imoveis": [], "descartados": []}
if len(parts) > 1:
    for p in parts[1:]:
        body = p.split("```")[0].strip()
        try:
            o = json.loads(body)
        except Exception as e:
            print("parse-fail:", str(e)[:100])
            continue
        if isinstance(o, dict):
            data["imoveis"] += o.get("imoveis", [])
            data["descartados"] += o.get("descartados", [])
        elif isinstance(o, list):
            data["imoveis"] += o
else:
    try:
        o = json.loads(raw.strip())
        if isinstance(o, dict):
            data["imoveis"] += o.get("imoveis", [])
            data["descartados"] += o.get("descartados", [])
        elif isinstance(o, list):
            data["imoveis"] += o
    except Exception as e:
        print("parse-fail:", str(e)[:100])

if not data["imoveis"] and not data["descartados"]:
    print("VAZIO — saída misteriosamente preservada, nada foi sobrescrito")
    sys.exit(1)

print("imoveis:", len(data["imoveis"]), "descartados:", len(data["descartados"]))
json.dump(data, open(out, "w", encoding="utf-8"), ensure_ascii=False)
print(Counter((x["bedrooms"], x.get("transaction", "aluguel")) for x in data["imoveis"]))
print("bairros:", sorted({x["neighborhood"] for x in data["imoveis"]}))
print("sem photoUrls:", sum(1 for x in data["imoveis"] if not x.get("photoUrls")))
print("photos<8:", [(x.get("id"), x.get("photosCount")) for x in data["imoveis"] if (x.get("photosCount") or 99) < 8])

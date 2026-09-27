"""Gera os literais TS da leva e appenda em lib/data.ts (idempotente).

Uso: python data/coleta/generate.py [AAAA-MM-DD]

- Lê merge-normalizado.json + download-manifest.json.
- Pula imóvel sem capa local e imóvel cujo id já está em lib/data.ts, então
  rodar duas vezes não duplica nada.
- Appenda no fim do array `apartments` (aluguel) ou `saleApartments` (venda).
  Nada de âncora: o snapshot 22/09/2026 usou uma âncora de uso único.
"""
import json
import os
import re
import sys
from datetime import date

BASE = "data/coleta"
DATA = "lib/data.ts"
VERIFIED_AT = sys.argv[1] if len(sys.argv) > 1 else date.today().isoformat()
# Portal de origem -> campo de id no schema do app. Derivado do próprio item
# (não do nome do arquivo), então "zap-l4" e "zap" geram o mesmo campo.
PORTAL_ID_FIELDS = ("zapId", "vivaId", "olxId", "apolarId", "codigoAnunciante")


def js(s):
    return json.dumps(s, ensure_ascii=False)


def portal_id_line(x):
    for field in PORTAL_ID_FIELDS:
        raw = x.get(field)
        if raw in (None, ""):
            continue
        # olxId é number no schema (lib/data.ts); os demais, string.
        if field == "olxId":
            return f"    {field}: {int(raw)},"
        return f"    {field}: {js(str(raw))},"
    return None


def entry_ts(x, photos):
    cover = photos[0]
    gal = photos[1:]
    lines = [
        "  {",
        f'    id: {js(x["id"])},',
        f'    title: {js(x["title"])},',
        f'    neighborhood: {js(x["neighborhood"])},',
        f'    address: {js(x["address"])},',
        f"    area: {x['area']},",
        f"    bedrooms: {x['bedrooms']},",
        f"    bathrooms: {x['bathrooms']},",
        f"    parking: {x['parking']},",
        f"    rent: {x['rent']},",
        f"    condo: {x['condo']},",
        f"    iptu: {x['iptu']},",
        f"    total: {x['total']},",
        '    phone: "",',
        '    email: "",',
        f'    link: {js(x["link"])},',
        f'    image: {js(cover)},',
        "    photos: [",
        f'      {{ src: {js(cover)}, caption: "Foto principal" }},',
    ]
    for p in gal:
        lines.append(f"      {{ src: {js(p)} }},")
    lines.append("    ],")
    lines.append(f"    features: {js(x.get('features', []))},")
    lines.append(f"    description: {js(x['description'])},")
    lines.append(f"    source: {js(x['source'])},")
    pid = portal_id_line(x)
    if pid:
        lines.append(pid)
    if x.get("condoUnknown"):
        lines.append("    condoUnknown: true,")
    if x.get("transaction") == "venda":
        lines.append('    transaction: "venda",')
        lines.append(f"    salePrice: {x['salePrice']},")
    if x.get("pets"):
        lines.append(f"    pets: {js(x['pets'])},")
    lines.append(f'    verifiedAt: {js(VERIFIED_AT)},')
    lines.append("  },")
    return "\n".join(lines)


def append_to_array(src, name, block):
    """Insere o block no array `name`, mesmo quando ele está vazio (`= [];`)."""
    m = re.search(rf"export const {name}: Apartment\[\] = ", src)
    if not m:
        raise SystemExit(f"data.ts: array {name} nao encontrado")
    # Array vazio: "= [];" -> "= [\n<block>\n];"
    vazio = re.match(r"\[\];", src[m.end() :])
    if vazio:
        return src[: m.end()] + "[\n" + block + "\n];" + src[m.end() + vazio.end() :]
    abre = src.index("[", m.end())
    end = src.index("\n];", abre)
    return src[:end] + "\n" + block + src[end:]


def main():
    items = json.load(open(f"{BASE}/merge-normalizado.json", encoding="utf-8"))
    manifest = json.load(open(f"{BASE}/download-manifest.json", encoding="utf-8"))
    src = open(DATA, encoding="utf-8").read()
    known = set(re.findall(r'id:\s*"([^"]+)"', src))

    rent_ts, sale_ts, drops, dupes = [], [], [], []
    for x in items:
        if x["id"] in known:
            dupes.append(x["id"])
            continue
        got = [
            p.replace("/public/imoveis", "/imoveis")
            for p in manifest.get(x["id"], [])
            if os.path.exists(p.lstrip("/"))
        ]
        if not got:
            drops.append(x["id"])
            continue
        t = entry_ts(x, got)
        (sale_ts if x.get("transaction") == "venda" else rent_ts).append(t)

    print(f"aluguel: {len(rent_ts)} | venda: {len(sale_ts)}")
    print(f"sem-capa (fora da leva): {drops}")
    print(f"ja-injetados (pulados): {dupes}")
    if rent_ts:
        src = append_to_array(src, "apartments", "\n".join(rent_ts))
    if sale_ts:
        src = append_to_array(src, "saleApartments", "\n".join(sale_ts))
    if rent_ts or sale_ts:
        open(DATA, "w", encoding="utf-8", newline="\n").write(src)
        print("data.ts atualizado")
    else:
        print("nada novo para injetar — data.ts intacto")


main()

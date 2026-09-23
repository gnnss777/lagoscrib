"""Gera os literais TS da expansão e insere em lib/data.ts (uma vez só)."""
import json
import os

BASE = "data/coleta"
DATA = "lib/data.ts"
PORTAL_ID_FIELD = {
    "zap": "zapId",
    "viva": "vivaId",
    "olx": "olxId",
    "apolar": "apolarId",
    "imobiliarias": "codigoAnunciante",
}


def js(s):
    return json.dumps(s, ensure_ascii=False)


def entry_ts(x, photos):
    cover = photos[0]
    gal = photos[1:]
    lines = [
        "  {",
        f'    id: {js(x["id"])},',
        f'    title: {js(x["title"])},',
        f'    neighborhood: {js(x["neighborhood"])},',
        f'    address: {js(x["address"])},',
        f'    area: {x["area"]},',
        f'    bedrooms: {x["bedrooms"]},',
        f'    bathrooms: {x["bathrooms"]},',
        f'    parking: {x["parking"]},',
        f'    rent: {x["rent"]},',
        f'    condo: {x["condo"]},',
        f'    iptu: {x["iptu"]},',
        f'    total: {x["total"]},',
        '    phone: "",',
        '    email: "",',
        f'    link: {js(x["link"])},',
        f'    image: {js(cover)},',
        "    photos: [",
        f'      {{ src: {js(cover)}, caption: "Foto principal" }},',
    ]
    for i, p in enumerate(gal, 1):
        lines.append(f"      {{ src: {js(p)} }},")
    lines.append("    ],")
    lines.append(f"    features: {js(x.get('features', []))},")
    lines.append(f"    description: {js(x['description'])},")
    lines.append(f"    source: {js(x['source'])},")
    pid = PORTAL_ID_FIELD[x["_fonte"]]
    raw_id = x.get(
        {"zap": "zapId", "viva": "vivaId", "olx": "olxId"}.get(x["_fonte"], ""),
        x.get("codigoAnunciante"),
    )
    if raw_id is None:
        raw_id = x.get("codigoAnunciante")
    if isinstance(raw_id, int) or (isinstance(raw_id, str) and raw_id.isdigit() and pid == "olxId"):
        lines.append(f"    {pid}: {int(raw_id)},")
    else:
        lines.append(f"    {pid}: {js(str(raw_id))},")
    if x.get("condoUnknown"):
        lines.append("    condoUnknown: true,")
    if x.get("transaction") == "venda":
        lines.append('    transaction: "venda",')
        lines.append(f"    salePrice: {x['salePrice']},")
    if x.get("pets"):
        lines.append(f"    pets: {js(x['pets'])},")
    lines.append('    verifiedAt: "2026-09-22",')
    lines.append("  },")
    return "\n".join(lines)


def main():
    items = json.load(open(f"{BASE}/merge-normalizado.json", encoding="utf-8"))
    manifest = json.load(open(f"{BASE}/download-manifest.json", encoding="utf-8"))
    rent_ts, sale_ts, drops = [], [], []
    for x in items:
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
    print(f"rent: {len(rent_ts)} | venda: {len(sale_ts)} | sem-capa: {drops}")

    src = open(DATA, encoding="utf-8").read()
    anchor_rent = '    zapId: "2912447929",\n    verifiedAt: "2026-09-22",\n  },\n];'
    assert src.count(anchor_rent) == 1, "âncora aluguel"
    src = src.replace(
        anchor_rent,
        '    zapId: "2912447929",\n    verifiedAt: "2026-09-22",\n  },\n'
        + "\n".join(rent_ts)
        + "];"
    )
    assert src.rstrip().endswith("];"), "fecho venda"
    head, _sep, _tail = src.rstrip().rpartition("\n];")
    src = head + "\n" + "\n".join(sale_ts) + "];\n"
    open(DATA, "w", encoding="utf-8").write(src)
    print("data.ts atualizado")


main()

"""Merge-check da expansão: normaliza, valida e detecta colisões (sem escrever no app)."""
import json, re, unicodedata
from collections import Counter

BASE = "data/coleta"
NEWLISTS = ["zap", "viva", "olx", "apolar", "imobiliarias"]

# Correções de quartos (divergência Quartos×dormitórios sinalizada pelos coletores;
# vale o descritivo/dormitórios).
BEDROOM_FIX = {
    "apolar-ahu-gabriela-mistral-78": 2,
    "apolar-fanny-br-116-76": 2,
    "apolar-merces-jacarezinho-115": 3,
    "apolar-santa-quiteria-capiberibe-85": 3,
}
# Sem nenhuma URL de foto: sem imagem para o app -> fora (registrado na evidência).
DROP_NO_PHOTOS = {"olx-capao-raso-eponino-macuco-28"}


def norm(s):
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", "", s)).strip()


def key_of(address, area, bedrooms, transaction):
    return (norm(address), int(round(area)), bedrooms, transaction)


def load_new():
    items = []
    for name in NEWLISTS:
        d = json.load(open(f"{BASE}/{name}.json", encoding="utf-8"))
        for x in d["imoveis"]:
            x = dict(x)
            x["_fonte"] = name
            items.append(x)
    return items


def existing_keys():
    """Extrai (id, address, area, bedrooms, transaction) do lib/data.ts atual."""
    src = open("lib/data.ts", encoding="utf-8").read()
    out = []
    for m in re.finditer(
        r'id:\s*"([^"]+)",.*?address:\s*"([^"]+)",.*?area:\s*([\d.]+),'
        r".*?bedrooms:\s*(\d+),",
        src,
        re.S,
    ):
        block_end = src.find("},", m.start())
        block = src[m.start() : block_end]
        trans = "venda" if 'transaction: "venda"' in block else "aluguel"
        out.append((m.group(1), m.group(2), float(m.group(3)), int(m.group(4)), trans))
    return out


def normalize(x):
    if x["id"] in DROP_NO_PHOTOS:
        return None
    if not x.get("photoUrls"):
        return None
    x = dict(x)
    for f in ("area", "rent", "condo", "iptu", "total", "salePrice"):
        if f in x and isinstance(x[f], float):
            x[f] = int(round(x[f]))
    if x["id"] in BEDROOM_FIX:
        x["bedrooms"] = BEDROOM_FIX[x["id"]]
    is_venda = x.get("transaction") == "venda" or (
        x.get("rent", 0) == 0 and x.get("total", 0) > 20000
    )
    if is_venda:
        x["transaction"] = "venda"
        x["salePrice"] = x.get("salePrice") or x["total"]
        x["total"] = x["salePrice"]
        x["rent"] = 0
    else:
        x.pop("transaction", None)
        x.pop("salePrice", None)
        x["rent"] = int(x.get("rent", 0))
        x["total"] = x["rent"] + int(x.get("condo", 0)) + int(x.get("iptu", 0))
    x.pop("salePrice", None) if not is_venda else None
    if "salePrice" in x and x["salePrice"] == 0:
        del x["salePrice"]
    x["photoUrls"] = x["photoUrls"][:11]
    return x


def main():
    raw = load_new()
    print("brutas:", len(raw))
    normed, problems = [], []
    for x in raw:
        n = normalize(x)
        if n is None:
            problems.append(("drop-sem-foto", x["id"]))
        else:
            # total consistente?
            if n.get("transaction") == "venda":
                if n["total"] != n["salePrice"]:
                    problems.append(("total-venda", x["id"]))
            else:
                if n["total"] != n["rent"] + n["condo"] + n["iptu"]:
                    problems.append(("total-aluguel", x["id"]))
            if (n.get("photosCount") or 99) < 8:
                problems.append(("fotos<8", x["id"]))
            normed.append(n)
    print("normalizadas:", len(normed), "| problemas:", problems)

    seen = {}
    for id_, addr, area, bed, trans in existing_keys():
        seen[key_of(addr, area, bed, trans)] = f"EXISTENTE:{id_}"
    print("existentes:", len(seen))
    collisions = []
    for x in normed:
        k = key_of(
            x["address"],
            x["area"],
            x["bedrooms"],
            x.get("transaction", "aluguel"),
        )
        if k in seen:
            collisions.append((x["id"], seen[k], x["address"]))
        else:
            seen[k] = x["id"]
    print("colisões:", len(collisions))
    for c in collisions:
        print("  ", c)

    rent = [x for x in normed if x.get("transaction") != "venda"]
    venda = [x for x in normed if x.get("transaction") == "venda"]
    print("aluguel:", len(rent), "| venda:", len(venda))
    print("combo:", Counter((x["bedrooms"], x.get("transaction", "aluguel")) for x in normed))
    print("bairros novos:", len({x["neighborhood"] for x in normed}))
    print("max rent total:", max(x["total"] for x in rent))
    print("max venda:", max(x["total"] for x in venda))
    print("max area:", max(x["area"] for x in normed))
    print("max condo (aluguel):", max(x["condo"] for x in rent))
    json.dump(
        normed,
        open(f"{BASE}/merge-normalizado.json", "w", encoding="utf-8"),
        ensure_ascii=False,
    )
    print("merge-normalizado.json gravado")


main()

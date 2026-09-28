"""Merge-check da leva: normaliza, valida e detecta colisões (sem escrever no app).

Uso: python data/coleta/merge.py [fonte ...]
     fontes sem argumento = as 5 listas do snapshot 22/09/2026 (retrocompat).
     Exemplo: python data/coleta/merge.py zap-l4 viva-l4 olx-l4 apolar-l4
"""
import json, re, sys, unicodedata
from collections import Counter

BASE = "data/coleta"
DEFAULT_SOURCES = ["zap", "viva", "olx", "apolar", "imobiliarias"]
SOURCES = [s.removesuffix(".json") for s in sys.argv[1:]] or DEFAULT_SOURCES

# Correções de quartos (divergência Quartos×dormitórios sinalizada pelos coletores;
# vale o descritivo/dormitórios). Vazio na leva 4 — o coletor já valida.
BEDROOM_FIX = {}
# Sem nenhuma URL de foto: sem imagem para o app -> fora (registrado na evidência).
DROP_NO_PHOTOS = set()
# Teto do produto: R$ 3.500 com TODAS as taxas (aluguel + condomínio + IPTU).
# O filtro de busca dos portais é só por aluguel (--preco-max), então sem esta
# regra a base aceita imóvel de R$ 2.500 de aluguel com R$ 1.300 de condomínio.
MAX_TOTAL_ALUGUEL = 3500
# Ids derrubados por esse teto, para o motivo sair certo na evidência.
ACIMA_DO_TETO = set()

PORTAL_ID_FIELDS = ("zapId", "vivaId", "olxId", "apolarId", "codigoAnunciante")


def norm(s):
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", "", s)).strip()


def key_of(address, area, bedrooms, transaction):
    return (norm(address), int(round(area)), bedrooms, transaction)


def load_new():
    items = []
    for name in SOURCES:
        d = json.load(open(f"{BASE}/{name}.json", encoding="utf-8"))
        for x in d["imoveis"]:
            x = dict(x)
            x["_fonte"] = name
            items.append(x)
    return items


def read_data_ts():
    return open("lib/data.ts", encoding="utf-8").read()


def existing_keys():
    """Extrai (id, address, area, bedrooms, transaction) do lib/data.ts atual."""
    src = read_data_ts()
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


def existing_portal_ids():
    """Ids de portal já em lib/data.ts.

    Zap e VivaReal são a mesma plataforma (Zap Group, mesmo espaço de ids):
    o mesmo id nos dois portais é o MESMO imóvel. Sem esta checagem, um
    anúncio síndico entraria duas vezes na base.
    """
    src = read_data_ts()
    out = set()
    for field in PORTAL_ID_FIELDS:
        for m in re.finditer(rf"\b{field}:\s*\"?(\w+)\"?", src):
            out.add(m.group(1))
    return out


def portal_id_of(x):
    for field in PORTAL_ID_FIELDS:
        v = x.get(field)
        if v not in (None, ""):
            return str(v)
    return None


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
        # ADR-001 §4: condomínio desconhecido é condo 0 + condoUnknown — nunca
        # valor inventado. Normaliza para o total fechar com totalAllIn().
        if x.get("condoUnknown"):
            x["condo"] = 0
        x["condo"] = int(x.get("condo", 0))
        x["iptu"] = int(x.get("iptu", 0))
        x["total"] = x["rent"] + x["condo"] + x["iptu"]
        if x["total"] > MAX_TOTAL_ALUGUEL:
            ACIMA_DO_TETO.add(x["id"])
            return None
    if "salePrice" in x and x["salePrice"] == 0:
        del x["salePrice"]
    x["photoUrls"] = x["photoUrls"][:11]
    return x


def main():
    raw = load_new()
    print("fontes:", ", ".join(SOURCES))
    print("brutas:", len(raw))
    normed, problems = [], []
    for x in raw:
        n = normalize(x)
        if n is None:
            problemas.append(
                ("acima-do-teto" if x["id"] in ACIMA_DO_TETO else "drop-sem-foto", x["id"])
            )
        else:
            # total consistente?
            if n.get("transaction") == "venda":
                if n["total"] != n["salePrice"]:
                    problems.append(("total-venda", n["id"]))
            else:
                if n["total"] != n["rent"] + n["condo"] + n["iptu"]:
                    problems.append(("total-aluguel", n["id"]))
            if (n.get("photosCount") or 99) < 8:
                problems.append(("fotos<8", n["id"]))
            normed.append(n)
    print("normalizadas:", len(normed), "| problemas:", problems)

    seen = {}
    for id_, addr, area, bed, trans in existing_keys():
        seen[key_of(addr, area, bed, trans)] = f"EXISTENTE:{id_}"
    print("existentes:", len(seen))

    portal_ids = existing_portal_ids()
    collisions = []
    for x in normed:
        pid = portal_id_of(x)
        if pid and pid in portal_ids:
            collisions.append((x["id"], f"ID-JA-EXISTE:{pid}", x["address"]))
            continue
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
            if pid:
                portal_ids.add(pid)
    print("colisões:", len(collisions))
    for c in collisions:
        print("  ", c)

    kept = [x for x in normed if x["id"] not in {c[0] for c in collisions}]
    rent = [x for x in kept if x.get("transaction") != "venda"]
    venda = [x for x in kept if x.get("transaction") == "venda"]
    print("mantidos:", len(kept), "| aluguel:", len(rent), "| venda:", len(venda))
    print("por fonte:", Counter(x["_fonte"] for x in kept))
    print("combo:", Counter((x["bedrooms"], x.get("transaction", "aluguel")) for x in kept))
    print("bairros novos:", len({x["neighborhood"] for x in kept}))
    if rent:
        print("max rent total:", max(x["total"] for x in rent))
        print("max condo (aluguel):", max(x["condo"] for x in rent))
    if venda:
        print("max venda:", max(x["total"] for x in venda))
    print("max area:", max(x["area"] for x in kept))
    json.dump(
        kept,
        open(f"{BASE}/merge-normalizado.json", "w", encoding="utf-8"),
        ensure_ascii=False,
    )
    print("merge-normalizado.json gravado")


main()

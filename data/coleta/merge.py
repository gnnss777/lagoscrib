"""Merge-check da leva: normaliza, valida e detecta colisões (sem escrever no app).

Uso: python data/coleta/merge.py [--perfil=NOME] [--teto=N] [fonte ...]
     sem argumento = as fontes do perfil default (retrocompat: as 5 listas do
     snapshot 22/09/2026, base `dono`).
     Exemplo: python data/coleta/merge.py zap-l4 viva-l4 olx-l4 apolar-l4
     Exemplo: python data/coleta/merge.py --perfil=thais data/thais/chaves.json

Cada perfil tem o seu diretório, a sua base de dados e o seu teto — ver
`perfis.json`. Teto: --teto= > COLETA_TETO_ALLIN > perfil.tetoAllin > 3600.
"""
import json, os, re, sys, unicodedata
from collections import Counter

# `perfis.py` e importado: sem isto cada roda deixa data/coleta/__pycache__/
# sujando a arvore de trabalho (o .gitignore nao e nosso para editar).
sys.dont_write_bytecode = True
from perfis import caminho_fonte, carregar, separar_argv

FLAGS, ARGV = separar_argv(sys.argv[1:])
PERFIL = carregar(FLAGS)
BASE = PERFIL.dir
# Fonte = nome dentro do diretório do perfil (`zap`) ou caminho direto
# (`data/thais/x.json`), porque o coletor do 2º cliente escolhe o nome do arquivo.
SOURCES = ARGV or PERFIL.fontes
RESOLVIDAS = [caminho_fonte(BASE, s) for s in SOURCES]
FONTES = [nome for _caminho, nome in RESOLVIDAS]

# Correções de quartos (divergência Quartos×dormitórios sinalizada pelos coletores;
# vale o descritivo/dormitórios). Vazio na leva 4 — o coletor já valida.
BEDROOM_FIX = {}
# Sem nenhuma URL de foto: sem imagem para o app -> fora (registrado na evidência).
DROP_NO_PHOTOS = set()
# Teto do produto: R$ 3.600 com TODAS as taxas (aluguel + condomínio + IPTU).
# O filtro de busca dos portais é só por aluguel (--preco-max), então sem esta
# regra a base aceita imóvel de R$ 2.500 de aluguel com R$ 1.300 de condomínio.
# Por perfil: o dono barra em 3600, o 2º cliente tem teto 8000. É o choke point
# do filtro (ADR-005) — trocar o valor aqui é a única coisa que muda.
MAX_TOTAL_ALUGUEL = PERFIL.teto_allin
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
    for caminho, nome in RESOLVIDAS:
        if not os.path.exists(caminho):
            # Fonte ausente não derruba a leva: avisa e segue. Zerar a base
            # inteira por um nome de arquivo errado seria apagão.
            print(f"AVISO: fonte ausente, ignorada: {caminho}")
            continue
        d = json.load(open(caminho, encoding="utf-8"))
        for x in d["imoveis"]:
            x = dict(x)
            x["_fonte"] = nome
            items.append(x)
    return items


def read_data_ts():
    # Base do próprio perfil: a colisão é medida contra a base que este cliente
    # realmente tem. Antes da 1a leva a base não existe (2º cliente) — vazio.
    if not os.path.exists(PERFIL.data):
        return ""
    return open(PERFIL.data, encoding="utf-8").read()


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
    PERFIL.garantir_dir()
    raw = load_new()
    print(f"perfil: {PERFIL.nome} | base: {PERFIL.dir} -> {PERFIL.data}")
    print("teto all-in: R$", PERFIL.teto_allin)
    print("fontes:", ", ".join(FONTES))
    print("brutas:", len(raw))
    normed, problemas = [], []
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
                    problemas.append(("total-venda", n["id"]))
            else:
                if n["total"] != n["rent"] + n["condo"] + n["iptu"]:
                    problemas.append(("total-aluguel", n["id"]))
            if (n.get("photosCount") or 99) < 8:
                problemas.append(("fotos<8", n["id"]))
            normed.append(n)
    print("normalizadas:", len(normed), "| problemas:", problemas)

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
    if kept:
        print("max area:", max(x["area"] for x in kept))
    else:
        print("nada sobreviveu a teto/foto — base do perfil vai ficar vazia")

    # Anti-apagão: nenhuma fonte lida é motivo para não sobrescrever uma leva
    # boa já normalizada. Sem esse guarda, `merge.py --perfil=x` com nome de
    # arquivo errado zerava a base inteira.
    #
    # O segundo guarda é o que faltava: `raw` cheio com `kept` vazio. É o caso
    # MEDIDO de rodar sem argumento de arquivo, que resolve para
    # PERFIL.fontes ("chavesnamao") e devolve a leva antiga — toda ela já
    # colidindo com a base, logo 0 mantidos. Escrever aí deixava o arquivo de
    # staging vazio e imprimia "a base do perfil vai ficar vazia", que é
    # MENTIRA: a base (lib/data-thais.ts) é aditiva e não era afetada. O que
    # some é a leva em andamento, e sem erro visível.
    #
    # "Li fonte mas não aprovei nada" com staging bom no disco é sempre bug de
    # chamada, não resultado legítimo. Sai com código != 0 para o pipeline
    # parar em vez de seguir para o generate com nada.
    if not raw and os.path.exists(PERFIL.merge):
        print(f"AVISO: 0 imóveis lidos — {PERFIL.merge} preservado")
        return
    if raw and not kept and os.path.exists(PERFIL.merge):
        anterior = 0
        try:
            with open(PERFIL.merge, encoding="utf-8") as f:
                anterior = len(json.load(f))
        except Exception:
            anterior = 0
        if anterior:
            print(
                f"\nERRO: li {len(raw)} imóveis de {', '.join(FONTES)} e mantive 0, "
                f"mas {PERFIL.merge} tinha {anterior} imóveis de uma leva boa.\n"
                f"Causa provável: arquivo de fonte errado (sem argumento, o merge "
                f"resolve para PERFIL.fontes e lê a leva antiga).\n"
                f"Passa o arquivo: python data/coleta/merge.py --perfil={PERFIL.nome} "
                f"{PERFIL.dir}/<arquivo>.json\n"
                f"{PERFIL.merge} PRESERVADO — nada foi escrito."
            )
            sys.exit(2)
    with open(PERFIL.merge, "w", encoding="utf-8", newline="\n") as f:
        json.dump(kept, f, ensure_ascii=False)
    print(f"{PERFIL.merge} gravado ({len(kept)} imóveis)")


main()

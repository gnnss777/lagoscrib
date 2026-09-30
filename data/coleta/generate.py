"""Gera os literais TS da leva e escreve na base do perfil (idempotente).

Uso: python data/coleta/generate.py [--perfil=NOME] [AAAA-MM-DD]

- Lê <perfil>/merge-normalizado.json + <perfil>/download-manifest.json.
- Pula imóvel sem capa local e imóvel cujo id já está na base do perfil, então
  rodar duas vezes não duplica nada.
- Acrescenta no fim do array `apartments` (aluguel) ou `saleApartments` (venda).
  Nada de âncora: o snapshot 22/09/2026 usou uma âncora de uso único.

## Append ou gerar do zero?
A base de cada cliente é **gerada do zero a partir do seed do perfil**, nunca
append no arquivo de outro cliente. Sem isso, `lib/data-thais.ts` nasceria como
uma cópia de `lib/data.ts` e o 2º cliente herdaria os 152 imóveis do dono — a
base dele jamais poderia ser regenerada nem zerada sem perder a linha de
produção do dono, e `verify` do app leria os dois clientes misturados.

O seed (`perfis.json` → `seed`) é o schema em branco com os arrays vazios. Na
1a vez o arquivo alvo não existe e o seed vira o arquivo; a partir daí é append
normal. Idempotência não vem do seed, vem de `known` ser lido **do arquivo do
perfil**: nunca de `lib/data.ts`. Recomeçar a base do 2º cliente, portanto, é
apagar o arquivo dele e rodar de novo — os dados do dono não são atingidos.
"""
import json
import os
import re
import sys
from datetime import date

# `perfis.py` e importado: sem isto cada roda deixa data/coleta/__pycache__/
# sujando a arvore de trabalho (o .gitignore nao e nosso para editar).
sys.dont_write_bytecode = True
from perfis import carregar, ler_manifest, ler_merge, seed_de, separar_argv, url_publico

FLAGS, ARGV = separar_argv(sys.argv[1:])
PERFIL = carregar(FLAGS)
DATA = PERFIL.data
VERIFIED_AT = ARGV[0] if ARGV else date.today().isoformat()
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
        # phone vem do coletor (Zap/VivaReal: clique em "mostrar telefone";
        # Apolar: campo lojacelular da API). Antes era literal "" aqui, e era
        # essa linha que apagava o telefone mesmo com o dado no JSON.
        # Anti-apagão: seguro por construção — main() pula id já presente em
        # lib/data.ts, então entrada existente nunca é reescrita.
        f"    phone: {js(x.get('phone', ''))},",
        # Nenhum dos 4 portais publica e-mail do anunciante no payload que
        # usamos. Segue vazio de propósito, não por esquecimento.
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
    items = ler_merge(PERFIL)
    manifest = ler_manifest(PERFIL)
    ja_existia = os.path.exists(DATA)
    src = seed_de(PERFIL)
    known = set(re.findall(r'id:\s*"([^"]+)"', src))
    if not ja_existia:
        print(f"{DATA} nao existia: gerado do zero a partir do seed {PERFIL.seed}")
    print(f"perfil: {PERFIL.nome} | {len(items)} no merge | {len(known)} ids na base")

    rent_ts, sale_ts, drops, dupes = [], [], [], []
    for x in items:
        if x["id"] in known:
            dupes.append(x["id"])
            continue
        got = [
            url_publico(p)
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
    # Base nova entra em disco mesmo vazia: sem isso o app não tem o que importar
    # e o próximo run refaz o seed do zero (idempotente, mas inútil).
    if rent_ts or sale_ts or not ja_existia:
        open(DATA, "w", encoding="utf-8", newline="\n").write(src)
        print(f"{DATA} atualizado")
    else:
        print(f"nada novo para injetar — {DATA} intacto")


main()

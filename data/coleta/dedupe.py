"""Junta o mesmo imóvel anunciado em portais diferentes.

Uso:
    python data/coleta/dedupe.py --perfil=NOME [--corte=9] [--dry-run] [--selfcheck]

## Por que isto existe

Zap e VivaReal são a mesma empresa e anunciam o mesmo estoque. Um
apartamento em Cristo Rei aparece nos dois com 66 m² num e 67 m² no outro.
A chave de colisão do `merge.py` é (endereço, área, quartos, transação), e
66 != 67: o duplicado passa direto. MEDIDO na base do dono: 6 pares entre
portais, 4 imóveis reais contados 2-3 vezes cada.

## Por que campos independentes, e não o endereço

Endereço é o campo mais fraco que existe aqui. MEDIDO: parte da base tem
`address` degenerado, que é só o bairro repetido (`"Cristo Rei, Cristo Rei,
Curitiba - PR"`), sem rua nenhuma. Comparar por ele dá 1.000 falsos positivos
— e o primeiro corte que fiz markava "mesmo bairro" como acerto de endereço e
inflava o score. Endereço só pontua quando os DOIS têm rua e elas casam.

Aluguel é o oposto: valor contínuo. Dois imóveis diferentes no mesmo bairro
terem o mesmo aluguel, a mesma área, os mesmos banheiros e o mesmo
condomínio ao mesmo tempo é improvável o bastante para tratar como identidade.

## Regra de sobrevivência

O mais completo vence: mais fotos primeiro, depois descrição mais longa,
depois endereço com rua. Foto é o que a pessoa vê no card, então é o que
importa mais. Os links do absorvido NÃO somem: vão para `otherLinks[]`, então
a procedência inteira continua alcançável.

## Lápide

`merged-away.json` guarda os ids absorvidos, porque `generate.py` é ADITIVO:
sem a lápide, a próxima leva traz o id de volta e o duplicado renasce.
"""
import json
import os
import re
import sys
import unicodedata

sys.dont_write_bytecode = True
from perfis import carregar, separar_argv

# Campo -> peso. Soma máxima com todos batendo: 13.7.
PESOS = {
    "aluguel": 2.5,
    "area": 2.0,
    "quartos": 1.5,
    "banheiros": 1.0,
    "vagas": 0.7,
    "condominio": 1.5,
    "rua": 2.5,
}
# "bairro" NÃO pontua: ver acima. Dois imóveis no mesmo bairro é a coisa mais
# comum que existe em Curitiba.

CAMPOS_NUM = {
    "area": "area",
    "quartos": "bedrooms",
    "banheiros": "bathrooms",
    "vagas": "parking",
    "aluguel": "rent",
    "condominio": "condo",
}
# Tolerância: área em m² (portais arredondam), demais em fração (digitação).
TOL_NUM = {"area": ("abs", 2.0), "quartos": ("abs", 0), "banheiros": ("abs", 0),
           "vagas": ("abs", 0), "aluguel": ("frac", 0.02), "condominio": ("frac", 0.05)}

RE_BLOCO = re.compile(r"^  \{\n.*?^  \},$", re.S | re.M)
RE_CAMPO = re.compile(r'^\s*(\w+):\s*(.+?),\s*$', re.M)


def norm(s):
    """minúsculas, sem acento, sem pontuação."""
    if not s:
        return ""
    s = unicodedata.normalize("NFD", str(s).lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", s)).strip()


def plataforma(source):
    """`"Zap Imóveis · AP1936"` -> `"Zap Imóveis"`."""
    return (source or "").split("·")[0].strip()


RE_RUA = re.compile(r"\b(rua|avenida|av|travessa|alameda|praca|rodovia|estrada|r)\b")
RE_NUMERO = re.compile(r"\b\d{1,5}\b")


def tem_rua(endereco):
    """O endereço tem rua de verdade, ou é só o bairro repetido?

    MEDIDO na base do dono: `address` degenerado vem como
    "Cristo Rei, Cristo Rei, Curitiba - PR" e "Batel, Batel, Curitiba" —
    bairro repetido, zero informação de rua.

    A primeira versão contou PALAVRAS (>=3) e passou: "batel batel curitiba"
    tem 3, igual a "rua x 100 curitiba". O selfcheck pegou. O que separa um do
    outro é número de endereço ou palavra de logradouro, não tamanho.
    """
    n = norm(endereco)
    if not n:
        return False
    return bool(RE_NUMERO.search(n) or RE_RUA.search(n))


def parse(src):
    """Lista de blocos na ordem do arquivo, com o `texto` original intacto."""
    blocos = []
    for m in RE_BLOCO.finditer(src):
        texto = m.group(0)
        blocos.append(
            {
                "ini": m.start(),
                "fim": m.end(),
                "texto": texto,
                "id": _campo_str(texto, "id"),
                "source": _campo_str(texto, "source"),
                "link": _campo_str(texto, "link"),
                "address": _campo_str(texto, "address"),
                "neighborhood": _campo_str(texto, "neighborhood"),
                "area": _campo_num(texto, "area"),
                "bedrooms": _campo_num(texto, "bedrooms"),
                "bathrooms": _campo_num(texto, "bathrooms"),
                "parking": _campo_num(texto, "parking"),
                "rent": _campo_num(texto, "rent"),
                "condo": _campo_num(texto, "condo"),
                "n_fotos": texto.count('src: "'),
                "desc_len": len(_campo_str(texto, "description")),
            }
        )
    return blocos


def _campo_str(texto, nome):
    m = re.search(rf'^\s*{nome}:\s*("(?:[^"\\]|\\.)*")', texto, re.M)
    if not m:
        return ""
    try:
        return json.loads(m.group(1))
    except json.JSONDecodeError:
        return ""


def _campo_num(texto, nome):
    m = re.search(rf"^\s*{nome}:\s*(-?\d+(?:\.\d+)?)", texto, re.M)
    if not m:
        return None
    try:
        return float(m.group(1))
    except ValueError:
        return None


def comparar(a, b):
    """Campos que concordam entre dois anúncios. Devolve [(nome, ok)]."""
    det = []
    for nome, chave in CAMPOS_NUM.items():
        va, vb = a.get(chave), b.get(chave)
        if va is None or vb is None:
            det.append((nome, False))
            continue
        modo, tol = TOL_NUM[nome]
        if modo == "abs":
            det.append((nome, abs(va - vb) <= tol))
        else:
            det.append((nome, abs(va - vb) <= max(va, vb) * tol))
    ea, eb = norm(a.get("address")), norm(b.get("address"))
    sem_num = lambda x: re.sub(r"\s+\d+.*$", "", x).strip()
    if ea and tem_rua(ea) and (
        ea == eb or (sem_num(ea) and sem_num(ea) == sem_num(eb))
    ):
        det.append(("rua", True))
    else:
        det.append(("rua", False))
    return det


def pontos(det):
    return sum(PESOS.get(nome, 0) for nome, ok in det if ok)


def agrupar(blocos, corte):
    """Greedy, do par mais forte para o mais fraco.

    Union-find simples deixaria A~B e B~Cesserem um grupo mesmo com A e C sem
    nada a ver — a cadeia é o modo clássico de dedupe inventar duplicata. Aqui
    só entra no grupo quem concorda com TODOS os que já estão nele.
    """
    pares = []
    for i, a in enumerate(blocos):
        for b in blocos[i + 1 :]:
            if plataforma(a["source"]) == plataforma(b["source"]):
                continue
            det = comparar(a, b)
            p = pontos(det)
            if p >= corte:
                pares.append((p, i, b, det))
    pares.sort(key=lambda t: -t[0])

    grupos, usado = [], set()
    for p, i, b, det in pares:
        if i in usado or id(b) in usado:
            continue
        grupo = [blocos[i], b]
        usado.add(i)
        usado.add(id(b))
        for c in blocos:
            if id(c) in usado:
                continue
            if all(
                pontos(comparar(c, g)) >= corte and plataforma(c["source"]) != plataforma(g["source"])
                for g in grupo
            ):
                grupo.append(c)
                usado.add(id(c))
        grupos.append({"pontos": p, "membros": grupo, "det": det})
    return grupos


def mais_completo(membros):
    """Vencedor: mais fotos, depois descrição mais longa, depois endereço com rua."""
    return max(
        membros,
        key=lambda x: (x["n_fotos"], x["desc_len"], tem_rua(x.get("address")),),
    )


def bloco_com_other_links(texto, links):
    """Insere `otherLinks` logo depois do `link` do anúncio."""
    if not links:
        return texto
    m = re.search(r'^(\s*link:\s*".*?",)$', texto, re.M)
    if not m:
        return texto
    lista = "\n".join(f"    {json.dumps(l, ensure_ascii=False)}," for l in links)
    return (
        texto[: m.end()]
        + "\n    // Anúncios do mesmo imóvel em outros portais (dedupe).\n"
        + "    otherLinks: [\n"
        + lista
        + "\n    ],"
        + texto[m.end() :]
    )


def aplicar(src, grupos):
    """Reescreve a base: absorvido sai, vencedor ganha `otherLinks`.

    Indexa por `id` do imóvel, NÃO por identidade do objeto: os blocos vêm de
    uma chamada de `parse()` e aqui o `parse()` roda DE NOVO, então `id(dict)`
    nunca bate e todo absorvido sobrevivia. O `id` do imóvel é estável e único
    na base (`generate.py` já deduplica por ele).

    Reconstrói percorrendo os blocos NA ORDEM ORIGINAL, porque `ini`/`fim` são
    deslocamentos do arquivo de entrada — aplicar em ordem arbitrária escreveria
    texto sobre texto.
    """
    remover = set()
    replace = {}
    for g in grupos:
        venc = mais_completo(g["membros"])
        absorvidos = [b for b in g["membros"] if b["id"] != venc["id"]]
        links = [b["link"] for b in absorvidos if b.get("link")]
        replace[venc["id"]] = bloco_com_other_links(venc["texto"], links)
        remover.update(b["id"] for b in absorvidos)

    out, cursor = [], 0
    for b in parse(src):
        out.append(src[cursor : b["ini"]])
        if b["id"] not in remover:
            out.append(replace.get(b["id"], b["texto"]))
        cursor = b["fim"]
    out.append(src[cursor:])
    return "".join(out)


def selfcheck():
    """Asserções do agrupamento. `python data/coleta/dedupe.py --selfcheck`."""
    # 0. ROUND-TRIP: parse + reescrever sem nada a decidir tem que devolver o
    #    arquivo byte a byte. É a rede que garante que o dedupe não corrompe a
    #    base: se `parse` não enxerga um bloco, `aplicar` o apaga silenciosamente.
    amostra = (
        "export const apartments: Apartment[] = [\n"
        '  {\n    id: "z",\n    title: "T",\n    link: "https://z",\n'
        '    area: 50,\n    source: "Zap Imóveis · X",\n'
        '    description: "d",\n    photos: [\n      { src: "/a.webp" },\n'
        "    ],\n  },\n"
        '  {\n    id: "v",\n    title: "T",\n    link: "https://v",\n'
        '    area: 50,\n    source: "VivaReal",\n'
        '    description: "d",\n    photos: [\n      { src: "/b.webp" },\n'
        "    ],\n  },\n"
        "];\n"
    )
    assert aplicar(amostra, []) == amostra, "round-trip alterou o arquivo"
    assert len(parse(amostra)) == 2, "parse perdeu bloco"

    def im(id, fonte, **kw):
        b = {
            "id": id, "source": fonte, "link": f"https://x/{id}",
            "address": kw.get("endereco", "Cristo Rei, Cristo Rei, Curitiba - PR"),
            "area": kw.get("area"), "bedrooms": kw.get("quartos"),
            "bathrooms": kw.get("banheiros"), "parking": kw.get("vagas"),
            "rent": kw.get("aluguel"), "condo": kw.get("condominio"),
            "n_fotos": kw.get("fotos", 0), "desc_len": kw.get("desc", 0),
        }
        return b

    # 1. mesmo anúncio, campos todos batendo -> junta
    a = im("a", "Zap Imóveis", area=66, quartos=2, banheiros=2, vagas=1,
           aluguel=2300, condominio=506, endereco="Rua X, 100, Cristo Rei, Curitiba",
           fotos=11, desc=2000)
    b = im("b", "Chaves na Mão", area=67, quartos=2, banheiros=2, vagas=1,
           aluguel=2300, condominio=506, endereco="Rua X, 100, Cristo Rei, Curitiba",
           fotos=11, desc=2000)
    g = agrupar([a, b], corte=9)
    assert len(g) == 1, f"deveria juntar, juntou {len(g)}"
    assert mais_completo(g[0]["membros"])["id"] in ("a", "b")

    # 2. MESMO portal -> nunca junta
    c = im("c", "Zap Imóveis", area=66, quartos=2, banheiros=2, vagas=1,
           aluguel=2300, condominio=506, endereco="Rua X, 100", fotos=11)
    d = im("d", "Zap Imóveis", area=66, quartos=2, banheiros=2, vagas=1,
           aluguel=2300, condominio=506, endereco="Rua X, 100", fotos=11)
    assert not agrupar([c, d], corte=9), "nunca junta dois do mesmo portal"

    # 3. endereço degenerado (só bairro) não pontua rua
    e = im("e", "Zap Imóveis", area=50, quartos=3, banheiros=2, vagas=1,
           aluguel=2000, condominio=300, endereco="Batel, Batel, Curitiba")
    f = im("f", "VivaReal", area=50, quartos=3, banheiros=2, vagas=1,
           aluguel=2000, condominio=300, endereco="Batel, Batel, Curitiba", fotos=5)
    det = comparar(e, f)
    assert not dict(det)["rua"], "bairro repetido não é rua"
    assert pontos(det) <= 9.7  # sem os 2.5 da rua

    # 4. mais completo vence: mais fotos
    g1 = im("p", "Zap Imóveis", area=50, quartos=2, banheiros=1, vagas=1,
            aluguel=2500, condominio=700, endereco="Rua Y, 5, Agua Verde", fotos=11, desc=50)
    g2 = im("q", "VivaReal", area=50, quartos=2, banheiros=1, vagas=1,
            aluguel=2500, condominio=700, endereco="Rua Y, 5, Agua Verde", fotos=3, desc=4000)
    venc = mais_completo([g1, g2])
    assert venc["id"] == "p", f"esperado mais fotos (p), veio {venc['id']}"

    # 5. otherLinks: o link do absorvido vai para o vencedor, nenhum se perde
    t = '  {\n    id: "a",\n    link: "https://zap/a",\n  },\n'
    out = bloco_com_other_links(t, ["https://viva/b"])
    assert "https://viva/b" in out and "otherLinks" in out
    assert "https://zap/a" in out  # link principal preservado

    # 6. etiqueta: peso tem que bater com a chave. Bug real: `rent` vs `aluguel`
    #    fazia o aluguel valer 0 e sumia com o duplicado.
    assert pontos([("aluguel", True), ("area", True), ("quartos", True)]) == \
        PESOS["aluguel"] + PESOS["area"] + PESOS["quartos"]

    # 7. aplicar() absorve de verdade e põe o link do absorvido no vencedor
    src = (
        "export const apartments: Apartment[] = [\n"
        '  {\n    id: "zap",\n    link: "https://zap",\n    source: "Zap Imóveis",\n'
        '    area: 66,\n    bedrooms: 2,\n    bathrooms: 2,\n    parking: 1,\n'
        '    rent: 2300,\n    condo: 506,\n    address: "Rua X, 100, Cristo Rei, Curitiba",\n'
        '    photos: [\n      { src: "/a.webp" },\n    ],\n    description: "d",\n  },\n'
        '  {\n    id: "viva",\n    link: "https://viva",\n    source: "VivaReal",\n'
        '    area: 67,\n    bedrooms: 2,\n    bathrooms: 2,\n    parking: 1,\n'
        '    rent: 2300,\n    condo: 506,\n    address: "Rua X, 100, Cristo Rei, Curitiba",\n'
        '    photos: [\n      { src: "/b.webp" },\n    ],\n    description: "d",\n  },\n'
        "];\n"
    )
    blocos = parse(src)
    grupos = agrupar(blocos, corte=9)
    assert len(grupos) == 1, f"round-trip: esperava 1 grupo, veio {len(grupos)}"
    novo = aplicar(src, grupos)
    assert 'id: "viva"' not in novo, "absorvido ficou na base"
    assert 'id: "zap"' in novo, "vencedor sumiu"
    assert "https://viva" in novo, "link do absorvido se perdeu"
    assert len(parse(novo)) == 1, "base ficou com bloco invalido"

    # 8. IDEMPOTÊNCIA byte a byte. Rodar duas vezes tem que dar o MESMO arquivo.
    #    Esta é a propriedade que eu ASSUMI em vez de medir: conferi "149 imóveis
    #    e 0 links perdidos", que é compatível com o resultado certo E com um
    #    resultado que fundiu imóvel que não devia. Conferir CONTAGEM não tem
    #    poder de discriminar — é preciso o arquivo ser igual.
    #    E o segundo run não pode achar grupo novo entre os vencedores remanescentes.
    def dois_grupos():
        return (
            '  {\n    id: "z",\n    link: "https://z",\n    source: "Zap Imóveis",\n'
            '    area: 66,\n    bedrooms: 2,\n    bathrooms: 2,\n    parking: 1,\n'
            '    rent: 2300,\n    condo: 506,\n    address: "Rua X, 100, Cristo Rei, Curitiba",\n'
            '    photos: [\n      { src: "/a.webp" },\n    ],\n    description: "d",\n  },\n'
            '  {\n    id: "v",\n    link: "https://v",\n    source: "VivaReal",\n'
            '    area: 67,\n    bedrooms: 2,\n    bathrooms: 2,\n    parking: 1,\n'
            '    rent: 2300,\n    condo: 506,\n    address: "Rua X, 100, Cristo Rei, Curitiba",\n'
            '    photos: [\n      { src: "/b.webp" },\n    ],\n    description: "d",\n  },\n'
            '  {\n    id: "outro",\n    link: "https://o",\n    source: "Apolar",\n'
            '    area: 120,\n    bedrooms: 3,\n    bathrooms: 2,\n    parking: 2,\n'
            '    rent: 3100,\n    condo: 400,\n    address: "Rua Y, 9, Batel, Curitiba",\n'
            '    photos: [\n      { src: "/c.webp" },\n    ],\n    description: "d",\n  },\n'
        )

    cab = (
        "export const apartments: Apartment[] = [\n" + dois_grupos() + "];\n"
    )
    passo1 = aplicar(cab, agrupar(parse(cab), corte=9))
    passo2 = aplicar(passo1, agrupar(parse(passo1), corte=9))
    assert passo1 == passo2, (
        "dedupe nao e idempotente: o segundo run mudou o arquivo. "
        "O primeiro ja absorveu, entao nao deveria sobrar grupo nenhum."
    )
    assert not agrupar(parse(passo1), corte=9), (
        "o segundo run achou grupo onde nao resta duplicado"
    )
    assert len(re.findall(r"otherLinks:", passo1)) == 1, (
        "o primeiro run devia ter escrito 1 otherLinks, nao "
        f"{len(re.findall(r'otherLinks:', passo1))}"
    )

    print(f"selfcheck: OK ({8} grupos de assercao)")


def abaixo_do_corte(blocos, corte, piso):
    """Pares entre portais na faixa [piso, corte) — os que o corte não pegou.

    Não é decoração: é o que o endereço degenerado CUSTA. MEDIDO: `zap-cristo-rei`
    (11 fotos, descrição de 2.405, R$ 2.300) NÃO entra no corte de 9 porque o
    endereço dele é "Cristo Rei, Cristo Rei, Curitiba - PR" e o do Chaves é
    "Avenida Presidente Affonso Camargo, 849" — sem rua não há como casar a rua,
    e a casa perde 2.5 pontos. Provavelmente é o mesmo imóvel, mas "provavelmente"
    não é "automaticamente". Fica na lista para olho humano.
    """
    out = []
    for i, a in enumerate(blocos):
        for b in blocos[i + 1 :]:
            if plataforma(a["source"]) == plataforma(b["source"]):
                continue
            det = comparar(a, b)
            p = pontos(det)
            if piso <= p < corte:
                out.append((p, a, b, det))
    out.sort(key=lambda t: -t[0])
    return out


def main():
    flags, _ = separar_argv(sys.argv[1:])
    if "selfcheck" in flags:
        selfcheck()
        return 0
    perfil = carregar(flags)
    corte = float(flags.get("corte") or 9)
    dry = "dry-run" in flags

    if not os.path.exists(perfil.data):
        raise SystemExit(f"{perfil.data} nao existe")
    src = open(perfil.data, encoding="utf-8").read()
    blocos = parse(src)
    print(f"perfil: {perfil.nome} | base: {perfil.data} | {len(blocos)} imoveis")
    print(f"corte: {corte}")

    # Trava de re-aplicação. Uma base já dedupeada tem `otherLinks` nos
    # vencedores. Regravar ali é a hora de um segundo run fundir coisa por
    # engano sem ninguém ver, porque a saída parece normal. `--reaplicar` diz
    # que a intenção é essa. Sem ela, sai antes de tocar em qualquer coisa.
    ja_dedupeada = any("otherLinks:" in b["texto"] for b in blocos)
    if ja_dedupeada and "reaplicar" not in flags and not dry:
        print(
            f"{perfil.data} JA PASSOU PELO DEDUPE "
            f"({sum(1 for b in blocos if 'otherLinks:' in b['texto'])} blocos "
            f"com otherLinks).\n"
            f"Isto e seguro (rodar de novo nao acha grupo), mas se a intencao "
            f"for reprocessar, passe --reaplicar.\n"
            f"Nada foi escrito."
        )
        return 3

    grupos = agrupar(blocos, corte)
    absorvidos, vencimentos = [], []
    for g in grupos:
        venc = mais_completo(g["membros"])
        abs_ = [b for b in g["membros"] if b is not venc]
        vencimentos.append(venc["id"])
        absorvidos += abs_
        print(f"\n  grupo {g['pontos']:.1f}pts -> vence {venc['id']} "
              f"({venc['n_fotos']} fotos, desc {venc['desc_len']})")
        for b in abs_:
            print(f"    absorve {b['id']} [{plataforma(b['source'])}] "
                  f"{b['n_fotos']}fotos  {b['address'][:40]}")

    if not grupos:
        print("\nnenhum duplicado no corte")
        return 0

    # Abaixo do corte: mostrado SEMPRE, mesmo com --dry-run, porque é a lista do
    # que o corte não pegou. Sem ela o relatório mente por omissão: parece que
    # não existe nada além dos grupos, quando na verdade existe sim e está fora
    # do corte por um endereço sem rua.
    quasi = abaixo_do_corte(blocos, corte, max(corte - 3.0, 0.0))
    if quasi:
        print(f"\n{'=' * 68}")
        print(f"ABAIXO DO CORTE ({max(corte - 3.0, 0.0):.1f}-{corte:.1f}) — "
              f"provavelmente o mesmo imóvel, precisa de olho humano")
        print("=" * 68)
        for p, a, b, det in quasi:
            print(f"\n  {p:.1f}pts | {plataforma(a['source'])} x "
                  f"{plataforma(b['source'])} | {a['neighborhood']}")
            print(f"    A {a['id']}")
            print(f"      {a['address'][:66]}")
            print(f"    B {b['id']}")
            print(f"      {b['address'][:66]}")
            print(f"    fogos A={a['n_fotos']} B={b['n_fotos']} | "
                  f"desc A={a['desc_len']} B={b['desc_len']}")
            print(f"    discordam: "
                  f"{', '.join(n for n, ok in det if not ok) or 'nada'}")

    if dry:
        print(f"\n--dry-run: {len(grupos)} grupos, {len(absorvidos)} imoveis "
              f"seriam absorvidos. Nada escrito.")
        return 0

    novo = aplicar(src, grupos)
    lapide = os.path.join(perfil.dir, "merged-away.json")
    os.makedirs(perfil.dir, exist_ok=True)
    json.dump(
        {
            "geradoEm": __import__("datetime").date.today().isoformat(),
            "corte": corte,
            "absorvidos": [b["id"] for b in absorvidos],
            "vencedores": vencimentos,
        },
        open(lapide, "w", encoding="utf-8"),
        ensure_ascii=False, indent=1,
    )
    open(perfil.data, "w", encoding="utf-8", newline="\n").write(novo)
    print(f"\n{perfil.data} reescrito: {len(blocos)} -> {len(blocos) - len(absorvidos)} imoveis")
    print(f"{lapide} gravado ({len(absorvidos)} ids)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
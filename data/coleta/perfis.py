"""Perfis de coleta: uma base isolada por cliente, no mesmo repo.

`perfis.json` e a unica fonte de verdade. Sem `--perfil=` vale `default`
(hoje `dono`, que reproduz o comportamento anterior byte a byte):

    --perfil=NAME   escolhe o perfil
    --teto=N        teto all-in (aluguel+condominio+IPTU) em R$, acima do perfil
    COLETA_PERFIL   mesmo efeito de --perfil=
    COLETA_TETO_ALLIN  mesmo efeito de --teto=

Precedencia do teto: --teto= > env > perfil.tetoAllin > DEFAULT_TETO_ALLIN.

`dir` e `data` sao relativos a raiz do repo (os tres scripts ja exigem rodar de
la). `fotos` e relativo tambem, e separado por perfil para uma leva de um
cliente nao encostar no disco do outro.
"""
import json
import os

AQUI = os.path.dirname(os.path.abspath(__file__))
PERFIS_JSON = os.path.join(AQUI, "perfis.json")
DEFAULT_TETO_ALLIN = 3600
ENV_PERFIL = "COLETA_PERFIL"
ENV_TETO = "COLETA_TETO_ALLIN"
# Perfil sem 'seed' e sem base: nao ha template de onde tirar o schema.
SEED_OBRIGATORIO = (
    "o perfil nao declara 'seed'. Crie o template (interface + arrays vazios) "
    "e aponte 'seed' no perfis.json."
)


class Perfil:
    """Resolucao de um perfil + os caminhos que ele fixa."""

    def __init__(self, nome, cfg):
        self.nome = nome
        self.dir = cfg["dir"]
        self.data = cfg["data"]
        self.fontes = list(cfg.get("fontes", []))
        self.fotos = cfg.get("fotos", "public/imoveis")
        self.seed = cfg.get("seed")
        self.teto_allin = int(cfg.get("tetoAllin", DEFAULT_TETO_ALLIN))

    @property
    def merge(self):
        return f"{self.dir}/merge-normalizado.json"

    @property
    def manifest(self):
        return f"{self.dir}/download-manifest.json"

    def garantir_dir(self):
        os.makedirs(self.dir, exist_ok=True)
        return self.dir

    def __repr__(self):
        return f"Perfil({self.nome}: {self.dir} -> {self.data}, teto {self.teto_allin})"


def separar_argv(argv):
    """argv -> (flags, posicionais). Aceita --k=v e --k (bool)."""
    flags, posicionais = {}, []
    for arg in argv:
        if arg.startswith("--"):
            chave, sep, valor = arg[2:].partition("=")
            flags[chave] = valor if sep else True
        else:
            posicionais.append(arg)
    return flags, posicionais


def flag_chave(flags, chave):
    """Valor de --chave=... ; erro se vier solto (--chave valor), porque o valor
    solto cairia no meio dos posicionais e virar nome de fonte/data."""
    v = flags.get(chave)
    if v is True:
        raise SystemExit(f"use --{chave}=<valor> (o valor solto vira argumento)")
    return v


def carregar(flags):
    perfis = _perfis()
    nome = flag_chave(flags, "perfil") or os.environ.get(ENV_PERFIL) or _padrao()
    cfg = perfis.get(nome)
    if cfg is None:
        raise SystemExit(
            f"perfil desconhecido: {nome!r} (disponiveis: {', '.join(sorted(perfis))})"
        )
    p = Perfil(nome, cfg)
    teto = flag_chave(flags, "teto") or os.environ.get(ENV_TETO)
    if teto not in (None, ""):
        p.teto_allin = _int(teto, "teto")
    return p


def caminho_fonte(base, arg):
    """Aceita nome de fonte (`zap`) ou caminho (`data/thais/x.json`, `x.json`).

    Devolve (caminho, nome): nome e o stem, o que vai para `_fonte` e para o
    relatorio "por fonte". Nao acopla o merge aos nomes que o coletor escolhe --
    o segundo cliente escreve onde quiser, via `--saida=` do coletor.
    """
    if os.path.isabs(arg) or "/" in arg or "\\" in arg:
        caminho = arg
    elif arg.endswith(".json"):
        caminho = f"{base}/{arg}"
    else:
        caminho = f"{base}/{arg}.json"
    return caminho, os.path.basename(caminho).removesuffix(".json")


def ler_merge(p):
    """A base normalizada do perfil.

    Erro claro (não traceback) quando ainda não existe: é o primeiro run de um
    cliente novo, e a ordem do pipeline é merge -> download -> generate.
    """
    if not os.path.exists(p.merge):
        raise SystemExit(
            f"{p.merge} nao existe — rode "
            f"`python data/coleta/merge.py --perfil={p.nome}` antes."
        )
    return json.load(open(p.merge, encoding="utf-8"))


def ler_manifest(p):
    """Manifest de downloads do perfil — o passo anterior do pipeline."""
    if not os.path.exists(p.manifest):
        raise SystemExit(
            f"{p.manifest} nao existe — rode "
            f"`python data/coleta/download.py --perfil={p.nome}` antes."
        )
    return json.load(open(p.manifest, encoding="utf-8"))


def caminho_fotos(fotos, iid, i):
    if i == 0:
        return f"{fotos}/{iid}.webp"
    return f"{fotos}/{iid}/{i:02d}.webp"


def caminho_manifesto(path):
    """Manifesto guarda o caminho em DISCO (`/public/imoveis/x.webp`), não a URL.

    O rewrite `public/` -> `/` é do generate.py, na hora de escrever o TS. O
    contrato é do dono e não se mexe: manifest com URL faz o existence check do
    generate.py (`os.path.exists(p.lstrip("/"))`) procurar `imoveis/...` na raiz
    e cair todo imóvel como "sem capa".
    """
    return "/" + path.replace("\\", "/")


def url_publico(caminho):
    """`/public/imoveis/x.webp` -> `/imoveis/x.webp` (o app serve a raiz public/).

    Genérico de propósito: um perfil com `fotos` em outro diretório
    (`/public/imoveis-thais/...` -> `/imoveis-thais/...`) sai certo sem config.
    O lstrip antes do removeprefix é obrigatório: o valor do manifesto já vem
    com `/` na frente e sem ele a saída sai `//public/...`.
    """
    caminho = caminho.replace("\\", "/").lstrip("/")
    return "/" + caminho.removeprefix("public/")


def seed_de(p):
    """Base de generate.py: o arquivo do perfil, ou o seed dele na 1a vez.

    Generate-from-zero em vez de append no arquivo do outro cliente: cada base
    nasce do proprio seed e so cresce com a propria leva. Idempotente porque o
    `known` e lido do arquivo do perfil, nunca de lib/data.ts.
    """
    if os.path.exists(p.data):
        return open(p.data, encoding="utf-8").read()
    if not p.seed:
        raise SystemExit(f"{p.data} nao existe e {SEED_OBRIGATORIO}")
    if not os.path.exists(p.seed):
        raise SystemExit(f"{p.data} nao existe e o seed do perfil tb nao: {p.seed}")
    return open(p.seed, encoding="utf-8").read()


def _padrao():
    if not os.path.exists(PERFIS_JSON):
        raise SystemExit(f"perfis.json ausente: {PERFIS_JSON}")
    return json.load(open(PERFIS_JSON, encoding="utf-8")).get("default", "")


def _perfis():
    if not os.path.exists(PERFIS_JSON):
        raise SystemExit(f"perfis.json ausente: {PERFIS_JSON}")
    return json.load(open(PERFIS_JSON, encoding="utf-8")).get("perfis", {})


def _int(valor, rotulo):
    try:
        return int(str(valor).strip())
    except ValueError:
        raise SystemExit(f"--{rotulo}={valor} nao e inteiro (R$)")

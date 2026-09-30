"""Baixa capa + galeria de cada imóvel normalizado, converte p/ webp local.

Uso: python data/coleta/download.py [--perfil=NOME] [--corrigir]

- Referer por portal: cada CDN recusa sem o seu (LL-046 era só Zap).
- Upscale: o coletor entrega o thumbnail; reescreve o parâmetro de dimensão
  para o tamanho de galeria (Zap/VivaReal `dimension=`, OLX `WId=/HId=`).
- Delay entre requests + retry: sem rate limit o CDN devolve 403 no meio da
  leva (LL-045).

Fotos e manifest são do perfil (perfis.json): a leva de um cliente não encosta
no disco do outro, e o manifest de cada um fica no diretório do perfil.
"""
import io
import json
import os
import sys
import time
import urllib.request
from urllib.parse import urlsplit

from PIL import Image

# `perfis.py` e importado: sem isto cada roda deixa data/coleta/__pycache__/
# sujando a arvore de trabalho (o .gitignore nao e nosso para editar).
sys.dont_write_bytecode = True
from perfis import caminho_fotos, caminho_manifesto, carregar, ler_merge, separar_argv

FLAGS, ARGV = separar_argv(sys.argv[1:])
PERFIL = carregar(FLAGS)
PERFIL.garantir_dir()
BASE = PERFIL.fotos
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
TIMEOUT = 30
DELAY = 1.5
RETRIES = 3
TARGET = "1280x853"

# Portal -> Referer exigido pelo CDN. Chave = host da foto, não o id do imóvel.
REFERERS = {
    "resizedimgs.zapimoveis.com.br": "https://www.zapimoveis.com.br/",
    "resizedimgs.vivareal.com": "https://www.vivareal.com.br/",
    "img.olx.com.br": "https://olx.com.br/",
    "cachefotos.apolar.net": "https://www.apolar.com.br/",
    # CDNs de imobiliárias (vistahost/pipeimob/imoview) não exigem Referer.
}


def referer_for(url):
    return REFERERS.get(urlsplit(url).hostname or "")


def upscale(url):
    """Reescreve o parâmetro de dimensão do CDN para o tamanho de galeria."""
    if "dimension=" in url:  # Zap / VivaReal: ...&dimension=614x297
        head, _, tail = url.partition("dimension=")
        rest = tail.split("&", 1)[1] if "&" in tail else ""
        return f"{head}dimension={TARGET}" + (f"&{rest}" if rest else "")
    if "WId=" in url and "HId=" in url:  # OLX: .../WId=600,HId=450/
        import re

        return re.sub(r"WId=\d+,HId=\d+", f"WId={TARGET.split('x')[0]},HId={TARGET.split('x')[1]}", url)
    return url


def fetch(url):
    headers = {"User-Agent": UA}
    ref = referer_for(url)
    if ref:
        headers["Referer"] = ref
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        if r.status != 200:
            raise OSError(f"HTTP {r.status}")
        return r.read()


MAX_BYTES = 350 * 1024  # teto do scripts/audit-photos.mjs
MIN_LONG = 800  # lado maior exigido pelo audit
MIN_SHORT = 500  # lado menor exigido pelo audit
LONGA_MAX = 1280  # lado maior alvo (CDN do Zap entrega 1280x853)


def _cabe(img):
    """Reajusta dimensao: reduz o lado maior se passou de LONGA_MAX, sobe o
    menor se ficou abaixo de MIN_SHORT (o CDN entrega portrait 480x853 em
    fit-in, e o audit exige menor >= 500)."""
    if max(img.size) > LONGA_MAX:
        escala = LONGA_MAX / max(img.size)
        img = img.resize((max(1, round(img.width * escala)), max(1, round(img.height * escala))), Image.LANCZOS)
    if min(img.size) < MIN_SHORT or max(img.size) < MIN_LONG:
        escala = max(MIN_LONG / max(img.size), MIN_SHORT / min(img.size))
        escala = escala * 1.03  # folga: arredondamento não pode ficar no limite
        img = img.resize((round(img.width * escala), round(img.height * escala)), Image.LANCZOS)
    return img


def save(raw, path):
    img = _cabe(Image.open(io.BytesIO(raw)).convert("RGB"))
    img.save(path, "WEBP", quality=80)
    return img.size


def corrigir_arquivo(caminho):
    """Re-encodeia um webp que estourou 350KB ou ficou abaixo do piso de pixel.
    Devolve (antes, depois)."""
    from PIL import Image as I

    buf = open(caminho, "rb").read()
    img = I.open(io.BytesIO(buf)).convert("RGB")
    precisa_bytes = len(buf) > MAX_BYTES
    precisa_px = min(img.size) < MIN_SHORT or max(img.size) < MIN_LONG
    if not (precisa_bytes or precisa_px):
        return len(buf), len(buf)
    img = _cabe(img)
    for qualidade in (80, 72, 64, 56, 48):
        img.save(caminho, "WEBP", quality=qualidade)
        if os.path.getsize(caminho) <= MAX_BYTES:
            break
    return len(buf), os.path.getsize(caminho)


def main():
    if FLAGS.get("corrigir"):
        alvos = []
        for x in ler_merge(PERFIL):
            galeria = f"{BASE}/{x['id']}"
            alvos.append(f"{galeria}.webp")
            if os.path.isdir(galeria):
                alvos += [f"{galeria}/{f}" for f in sorted(os.listdir(galeria))]
        reescritos = 0
        for p in alvos:
            if not os.path.exists(p):
                continue
            antes, depois = corrigir_arquivo(p)
            if depois != antes:
                reescritos += 1
                print(f"corrigiu {p}: {antes // 1024}KB -> {depois // 1024}KB")
        print(f"corrigidos: {reescritos}/{len(alvos)}")
        return
    items = ler_merge(PERFIL)
    manifest = {}
    pulados = 0
    for x in items:
        iid = x["id"]
        got = []
        for i, url in enumerate(x["photoUrls"][:11]):
            path = caminho_fotos(BASE, iid, i)
            if i > 0:
                os.makedirs(os.path.dirname(path), exist_ok=True)
            # Já existe e tem peso plausível: não refaz request. O
            # `download.py --corrigir` normaliza px/bytes do que já está no disco.
            if os.path.exists(path) and os.path.getsize(path) > 5000:
                got.append(caminho_manifesto(path))
                pulados += 1
                continue
            for attempt in range(1, RETRIES + 1):
                try:
                    raw = fetch(upscale(url))
                    # Valida pelo Pillow, não por magic bytes: o Apolar serve JPEG
                    # e o Zap/VivaReal servem WebP, e o Pillow abre HTML/403 como
                    # erro do mesmo jeito (o check de RIFF pegava só o Zap).
                    if len(raw) < 5000:
                        raise OSError(f"resposta pequena demais ({len(raw)}b) - erro/placeholder?")
                    save(raw, path)
                    got.append(caminho_manifesto(path))
                    break
                except Exception as e:
                    print(f"FALHA {iid} [{i}] try{attempt}: {type(e).__name__}: {e}")
                    time.sleep(DELAY * attempt)
            time.sleep(DELAY)
        manifest[iid] = got
        print(f"{iid}: {len(got)}/{min(11, len(x['photoUrls']))}")
    with open(PERFIL.manifest, "w", encoding="utf-8", newline="\n") as f:
        json.dump(manifest, f)
    ok = sum(1 for v in manifest.values() if v)
    print(f"com-capa: {ok}/{len(manifest)} | reusados do disco: {pulados}")


main()

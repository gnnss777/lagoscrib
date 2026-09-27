"""Baixa capa + galeria de cada imóvel normalizado, converte p/ webp local."""
import io
import json
import time
import urllib.request

BASE = "public/imoveis"
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) lagoscrib/1.0"}
TIMEOUT = 30
DELAY = 1.5  # LL-045: sem rate limit o CDN devolve 403 no meio da leva
TARGET = "1280x853"  # coletor entrega o thumbnail (614x297); o CDN devolve o que pedirmos


def upscale(url):
    """Portal manda a URL do thumbnail. Reescreve dimension= pro tamanho de galeria."""
    if "dimension=" not in url:
        return url
    head, _, tail = url.partition("dimension=")
    rest = tail.split("&", 1)[1] if "&" in tail else ""
    return f"{head}dimension={TARGET}" + (f"&{rest}" if rest else "")


def fetch(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        return r.read()


def main():
    from PIL import Image
    import os

    items = json.load(open("data/coleta/merge-normalizado.json", encoding="utf-8"))
    manifest = {}
    for x in items:
        iid = x["id"]
        got = []
        for i, url in enumerate(x["photoUrls"][:11]):
            try:
                raw = fetch(upscale(url))
                img = Image.open(io.BytesIO(raw)).convert("RGB")
                if i == 0:
                    path = f"{BASE}/{iid}.webp"
                else:
                    os.makedirs(f"{BASE}/{iid}", exist_ok=True)
                    path = f"{BASE}/{iid}/{i:02d}.webp"
                img.save(path, "WEBP", quality=82)
                got.append("/" + path.replace("\\", "/"))
            except Exception as e:
                print(f"FALHA {iid} [{i}]: {type(e).__name__}")
            time.sleep(DELAY)
        manifest[iid] = got
        print(f"{iid}: {len(got)}/{min(11, len(x['photoUrls']))}")
    json.dump(manifest, open("data/coleta/download-manifest.json", "w"))
    ok = sum(1 for v in manifest.values() if v)
    print(f"com-capa: {ok}/{len(manifest)}")


main()

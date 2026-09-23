"""Baixa capa + galeria de cada imóvel normalizado, converte p/ webp local."""
import io
import json
import urllib.request

BASE = "public/imoveis"
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) lagoscrib/1.0"}
TIMEOUT = 30


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
                raw = fetch(url)
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
        manifest[iid] = got
        print(f"{iid}: {len(got)}/{min(11, len(x['photoUrls']))}")
    json.dump(manifest, open("data/coleta/download-manifest.json", "w"))
    ok = sum(1 for v in manifest.values() if v)
    print(f"com-capa: {ok}/{len(manifest)}")


main()

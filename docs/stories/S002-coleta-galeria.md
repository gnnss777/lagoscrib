# S002 — F2 Coleta da galeria completa

- **Type:** Config/Data · **Estimativa:** 3–4h + tempo de coleta · **ADR:** ADR-001 (pipeline curado)
- **Arquivos:** `public/imoveis/<id>/`, `scripts/audit-photos.mjs` (novo, versionado), `docs/manifesto-fotos.md` (novo)
- **Out-of-scope:** UI da galeria (S003); capa atual vira `photos[0]` (manter `image` p/ compat).

## AC
1. ≥ 8 fotos válidas por imóvel (7 aluguel + cada venda da S001): magic bytes RIFF/WEBP, largura ≥ 800px, zero HTML/403, ≤ 350KB/arquivo, peso/imóvel ≤ 3,5MB. Meta ~90–110 arquivos.
2. Processo LL-045/046: browser real, extrair TODAS as URLs `resizedimgs`, normalizar `&amp;`→`&` e `\/`→`/`, baixar com `Referer: https://www.zapimoveis.com.br/` + UA desktop, delay 2–4s, retry com backoff, **2 levas** (aluguel; depois venda).
3. Nomeação/legendas: `01-fachada.webp, 02-sala.webp…`; planta do anúncio → `floorplan.webp` + `floorPlan` no schema.
4. `scripts/audit-photos.mjs` passa com 0 erros; `docs/manifesto-fotos.md` commitado (imóvel → nº fotos → peso total).
5. Capas existentes NÃO deletadas — novas fotos entram em `public/imoveis/<id>/`.

## Test Evidence
`docs/manifesto-fotos.md` + `docs/evidencia-galeria-*.png` (galeria renderizada com contador).

## story-readiness
- [x] ADR aceito · [x] AC testáveis com número · [x] Estimativa registrada
- [x] Evidência declarada · [x] Sem questão de design aberta
- **Veredito: READY**

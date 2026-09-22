# Manifesto de fotos — S002 (coleta 22/09/2026)

> 12 imóveis × (1 capa + 10 galeria) = **132 arquivos locais**. Auditoria: `node scripts/audit-photos.mjs` → **PASS (0 erros)**. Download: `node scripts/download-photos.mjs coleta/urls-leva{1,2,fix1080}.json` (Referer + UA desktop, delay 2,5s, retry com backoff — LL-045/046).

## Por imóvel (galeria: fotos × peso total)

| Imóvel | Fotos no anúncio | Coletadas | Peso total | Status |
|---|---|---|---|---|
| Água Verde Castro 123 (aluguel) | 18 | 10 | 326KB | ok |
| Água Verde Raul 90 (aluguel) | 20 | 10 | 553KB | ok |
| Ahú Eça 78 (aluguel) | 31 | 10 | 260KB | ok |
| Centro Comendador 130 (aluguel) | 17 | 10 | 227KB | ok |
| Centro Bufren 96 (aluguel) | 15 | 10 | 571KB | ok (ver notas) |
| Juvevê Goulin 66 (aluguel) | 22 | 10 | 155KB | ok |
| Cabral Manoel 104 (aluguel) | 14 | 10 | 550KB | ok |
| Bacacheri Paraná 107 (venda) | 25 | 10 | 319KB | ok |
| Tingui Brasílio 71 (venda) | 23 | 10 | 446KB | ok |
| Água Verde Iguaçu 140 (venda) | 49 | 10 | 591KB | ok |
| Capão Raso Churchill 78 (venda) | 39 | 10 | 394KB | ok |
| Ecoville Rosa 87 (venda) | 65 | 10 | 399KB | ok |

Todos ≤ 3,5MB/imóvel (maior: 591KB) e ≤ 350KB/arquivo. Capas existentes **não deletadas** — capa virou `photos[0]` (compat com `image`).

## Notas da coleta (decisões auditáveis)

1. **Dimensão 614→870→1080**: URLs extraídas vinham `614x297` (< 800px, fora do budget). Requisitadas a `870x707`; retratos ficaram com largura < 800px por construção do `fit-in` (ex.: 398x707) — **não é foto ruim, é geometria**. Probe provou que os originais têm mais pixels → fix em `1080x1080` (ex.: 398x707 virou 608x1080).
2. **Regra orientation-aware**: `DESIGN.md` §10 e `audit-photos.mjs` corrigidos — galeria exige lado maior ≥ 800px E lado menor ≥ 500px (retrato usa a altura como eixo). Regra antiga ("largura ≥ 800px") assumia paisagem.
3. **Bufren 02 (panorama 1080x499, 1px abaixo da barra)**: trocada pela sobressalente nº 11 do mesmo anúncio (foto real, mesma galeria) — curadoria, sem inventar nada.
4. **404 transitório do CDN**: 2 rendições 1080 retornaram `404 Not Found` na 1ª tentativa e passaram no retry — retry com backoff do script cobre; `curl` cru não.
5. **Legendas**: só `photos[0]` tem caption ("Foto principal"). Nomes de cômodo por arquivo seriam chute (URL não diz o cômodo) — regra "nunca inventar" prevalece; S003 gera `alt` como "{título} — foto N de M".
6. **Planta baixa**: nenhum anúncio exibia planta identificável na galeria → `floorPlan` não preenchido (S004 mostra "Planta não divulgada no anúncio").
7. **Fazendinha** (S001): fora — 5 fotos < 8 mínimas; Ecoville entrou no lugar.
8. **Screenshot da galeria renderizada** (AC4 do card): movido para S003 — a UI da galeria ainda não existe nesta story; S003 já exige screenshots de galeria/zoom.

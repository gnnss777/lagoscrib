# S009 — Coleta por bairro prioritário, +29 imóveis (leva 5)

- **Type:** Config/Data · **Estimativa:** ~1h30 (real) · **ADR:** ADR-001 (pipeline curado)
- **Data:** 27/09/2026 · **Base:** `lib/data.ts` 51 → **80** imóveis de aluguel
- **Escopo escolhido:** 2 quartos, aluguel até R$ 3.000, concentrado nos 8 bairros
  que o usuário pediu: Mercês, Bigorrilho, São Francisco, Centro, Centro Cívico,
  Água Verde, Batel e Vila Izabel.
- **Complementa** S008 (não substitui): os 51 anteriores continuam no app.

## Entregue

| Fonte | Coletado | Novo na base | Como |
|---|---|---|---|
| Apolar | 15 | 15 | `district` por bairro na API JSON do portal |
| Zap | 16 | 11 | filtro `-<slug>-curitiba-pr-` na URL do anúncio |
| VivaReal | 15 | 3 | idem; mesmo scraper (plataforma Zap Group) |
| **Total** | **46** | **29** | 17 fora: já na base ou o mesmo imóvel nos dois portais |

Base final: **80** imóveis = 66×2 quartos + 14×3, aluguel de R$ 950 a R$ 3.000
(nenhum acima do teto), all-in máximo R$ 6.362, 36 bairros.

## Os 8 bairros prioritários

| Bairro | Na base |
|---|---|
| Água Verde | 9 |
| Centro | 8 |
| Batel | 6 |
| Vila Izabel | 6 |
| Bigorrilho | 5 |
| Centro Cívico | 2 |
| Mercês | 1 |
| São Francisco | 1 |
| **Total** | **38** |

Mercês e São Francisco saíram finos porque é isso que os portais entregam: quase
nenhum anúncio de 2 quartos ≤ R$ 3.000 neles. `--por-bairro=3` impede que Centro e
Água Verde, que têm estoque, consumam a cota dos bairros ralos.

## O que mudou no scraper

Duas flags novas em `scripts/coleta/coleta.mjs`:

- `--bairros=Mercês,Bigorrilho,...` — restringe a coleta aos bairros. Nenhum portal
  aceita bairro na URL de busca, então o filtro é aplicado no anúncio: Apolar por
  `district` na API, Zap/VivaReal por sufixo no slug.
- `--por-bairro=N` — teto por bairro, para um bairro não comer a leva toda.

Bugs corrigidos no caminho:

1. **VivaReal zerava.** O parser só reconhecia `-curitiba-pr-`, então o slug
   `-bairros-curitiba-` (que o portal usa em parte das URLs) não casava e o
   anúncio ia para `descartados`. Agora os dois marcadores são aceitos.
2. **`audit-photos.mjs` reprovava imóvel com 8 fotos.** O gate contava só os
   arquivos do diretório de galeria, mas a galeria que o app mostra inclui a capa
   como primeira foto (`photos[0]`, via `getGalleryPhotos`). Faltava 1 na conta.

## AC

1. [x] 80 imóveis, todos com `link` https do anúncio original e `photos[]` com capa.
2. [x] Escopo travado: 2–3 quartos e aluguel ≤ R$ 3.000 — nenhum acima do teto.
3. [x] Os 8 bairros prioritários presentes na base (38 imóveis no total).
4. [x] ≥ 8 fotos por imóvel. `node scripts/audit-photos.mjs` → **PASS (0 erros)**.
5. [x] `npx vitest run` 136/136, `npm run typecheck`, `npm run lint`,
       `npm run build` e `npx playwright test` 25/25 verdes.

## Fora do escopo

- **OLX** continua fora: a lista orgânica não renderiza (ver S008).
- Fotos órfãs do snapshot de 109 imóveis continuam em `public/imoveis/` (o gate
  ignora o que não está na base). Limpar é trabalho separado, com review do diff.

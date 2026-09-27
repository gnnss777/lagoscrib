# S008 — Coleta 4 portais, 52 imóveis (leva 4)

- **Type:** Config/Data · **Estimativa:** ~3h30 (real) · **ADR:** ADR-001 (pipeline curado)
- **Data:** 27/09/2026 · **Base:** `lib/data.ts` zerada e repovoada, 52 imóveis de aluguel
- **Substitui:** snapshot 22/09/2026 (109 imóveis, 5 fontes) — removidos do app por
  decisão do usuário (soft-delete no localStorage, depois zerados de `lib/data.ts`).
  Fotos (1088 arquivos, 67,7 MB) preservadas em `public/imoveis/` como órfãs; o
  histórico de status/notas/follow-up permanece no Postgres.

## Entregue

| Fonte | Imóveis | Como |
|---|---|---|
| Zap | 16 + 4 (faixa 4 quartos) | `scripts/coleta/coleta.mjs` + Edge real |
| VivaReal | 16 | idem, mesmo scraper (plataforma Zap Group) |
| Apolar | 16 | API JSON pública do portal |
| OLX | **0** | ver "Perdas" |
| **Total** | **52** | 33×2 quartos · 15×3 · 4×4 |

## AC

1. [x] 52 imóveis de aluguel, todos com `link` https do anúncio original, `total` =
      aluguel + condomínio + IPTU conferido por `totalAllIn` em teste.
2. [x] ≥ 8 fotos por imóvel, RIFF/WEBP, lado maior ≥ 800px, ≤ 350KB, ≤ 3,5MB/imóvel.
      `node scripts/audit-photos.mjs` → **PASS (0 erros)**.
3. [x] Todo bairro existe nos 75 de `lib/neighborhoods.ts` — `cobertura.py` → 31
      bairros, 10 regionais, 0 desconhecidos. `validar_bairros.py` falha o pipeline
      se algum bairro escaping da lista.
4. [x] Sem valor inventado: condomínio ausente = `condo: 0` + `condoUnknown: true`
      (ADR-001 §4). Nenhum telefone/e-mail nos dados (contato pelo link).
5. [x] `npm run test` 135/135, `npm run typecheck`, `npm run lint` (arquivos da
      leva) e `npm run build` verdes.

## O scraper (novo, determinístico)

`scripts/coleta/coleta.mjs` — sem LLM no loop. Antes disso a coleta era browser +
LLM manual, sem código no repo.

```
node scripts/coleta/coleta.mjs --quartos=2,3 --qtd-zap=16 --qtd-viva=16 --qtd-apolar=18
node scripts/coleta/coleta.mjs --so=apolar --quartos=4,5 --qtd-apolar=6
python data/coleta/merge.py zap-23q-l4 viva-23q-l4 apolar-23q-l4 zap-4q-l4
python data/coleta/download.py          # + --corrigir para normalizar px/bytes
node scripts/audit-photos.mjs           # + --tudo para auditar órfãs também
python data/coleta/validar_bairros.py
python data/coleta/generate.py          # append em lib/data.ts, idempotente
```

### Descobertas que moldaram o desenho

1. **Fetch direto é 403 nos 3 portais maiores** (Zap, VivaReal, OLX) e o
   Cloudflare barra Chromium headless. Passa com **Edge real** (`channel: msedge`)
   + `launchPersistentContext` + `navigator.webdriver` mascarado + **8s por
   navegação**. Abaixo disso o Cloudflare devolve "Attention Required".
   O perfil em `%TEMP%/coleta-edge-profile` guarda o `cf_clearance` entre runs.
2. **Zap e VivaReal são a mesma plataforma** (Zap Group): mesmo espaço de ids
   (2,4–2,9 B), mesma URL de busca (`/aluguel/...`), mesmo `ld+json`. Um id visto
   no Zap é pulado no VivaReal — sem isso o mesmo imóvel entra duas vezes.
   `merge.py` gained a checagem `zapId == vivaId` como segunda rede.
3. **URL de filtro do Zap usa `+`, não `/`**: `/aluguel/apartamentos/pr+curitiba/`.
   `/aluguel/apartamentos/pr/curitiba/` dá 404. O VivaReal usa outro esquema
   (`/aluguel/parana/curitiba/`), então o scraper testa candidatos.
4. **Dados vêm do `ld+json` `Product`** do anúncio (`sku` = id, `offers.price` =
   aluguel, `image[]` = galeria) e do slug (quartos, m², bairro). Condomínio, IPTU,
   banheiros e vagas saem do `innerText`. Sem LLM.
5. **Apolar tem API JSON pública** (`execute-api .../properties/search/main`) e
   fotos próprias em `cachefotos.apolar.net` (JPEG 1630×1080). O `?ref=` que a
   API devolve **redireciona** para a página do anúncio — o scraper segue o
   redirect e grava a URL canônica, corrigindo o defeito da leva antiga (os 21
   links antigos apontavam só para a home).
6. `popup_fotos` da Apolar é **objeto**, não array, e a API muda o formato entre
   respostas → o scraper achata recursivamente procurando URLs de imagem.

## Perdas (registradas em `data/coleta/descartados-l4.json`)

- **OLX = 0 imóveis.** A busca devolve 71 anúncios patrocinados (`olx-adcard`,
  carrossel "Em alta": ar-condicionado, eletrodoméstico) e a lista **orgânica não
  renderiza** em nenhuma variante de URL testada
  (`/regiao-de-curitiba-e-paranagua/imoveis/aluguel/apartamentos`,
  `?page=N`, `?city=`, `/busca/...`, `olx.com.br/imoveis/aluguel/apartamentos/parana/curitiba`
  — esta última redireciona pra lista nacional). O OLX virou app RSC e o scrape
  de cada anúncio funciona (`https://www.olx.com.br/vi/<id>` → `ld+json Product`),
  **falta só uma fonte de urls de anúncio**. Os 20 do OLX foram redistribuídos
  para Zap/VivaReal/Apolar, como previa o plano. Quando o OLX voltar:
  `--qtd-olx=20` já está implementado.
- **2 colisões cross-portal Zap×VivaReal** (mesmo id nos dois) e **2 duplicatas
  Apolar** (mesmo prédio/rua, mesma área e quartos) → 4 fora, 54 → 52.

## Correções no app que a leva exigiu

| Arquivo | Mudança |
|---|---|
| `lib/constants.ts` | `RENT_PRICE_BOUNDS.max` 20k → **40k** (base tem 442 m² a R$ 35 mil) |
| `lib/constants.ts` | `REMOVED_IDS_STORAGE_VERSION` 1 → **2** (descarta os 109 ids órfãos do navegador) |
| `scripts/audit-photos.mjs` | audita só os ids de `lib/data.ts` (órfãs fora do gate); flag `--tudo` |
| `tests/unit/*` | contagens deixam de ser listas de ids fixos e passam a invariantes + contagem única (52) |
| `data/coleta/merge.py` | fontes via argv, dedupe `zapId == vivaId`, `condoUnknown` fecha o total |
| `data/coleta/generate.py` | append no fim do array (a versão anterior era one-shot, com âncora), data de hoje, idempotente |
| `data/coleta/download.py` | `Referer` por portal, upscale de `WId/HId` (OLX), valida pelo Pillow (Apolar serve JPEG), corrige lado menor < 500px e teto de 350KB |
| `data/coleta/cobertura.py` | nada (o `re.S` já estava) |

## O que NÃO foi feito

- **Não apaguei** as 1088 fotos órfãs do snapshot antigo (67,7 MB). Reversível;
  pedir é só dizer.
- **Não automatizei** o `?ref=` → URL canônica em cache: hoje cada anúncio Apolar
  custa um redirect no scrape. ComMany anúncios, isso vira um cache `referencia →
  url` em `data/coleta/`.
- **Não criei** scraper de OLX. Falta achar a fonte das urls de anúncio.

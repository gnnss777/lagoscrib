# S010 — Teto de R$ 3.500 all-in, base 80 → 64

- **Type:** Config/Data · **Data:** 27/09/2026 · **Base:** `lib/data.ts` 80 → **64**
- **Mudança de escopo:** o teto saiu de **R$ 3.000 de aluguel** e passou a ser
  **R$ 3.500 com todas as taxas** (aluguel + condomínio + IPTU). Decisão do usuário,
  depois de ver anúncio acima do preço no app.
- **Complementa** S008 e S009.

## O problema

O filtro de busca dos portais (`--preco-max`) é **por aluguel**. Então a base
aceitava imóvel de R$ 2.500 com R$ 1.300 de condomínio: passa o filtro, e o
usuário vê R$ 3.800 no total. **23 dos 80 imóveis estavam acima do teto**, o mais
caro com R$ 6.362 all-in (aluguel R$ 2.990 + condo + IPTU).

## Onde o teto foi aplicado

| lugar | papel |
|---|---|
| `lib/constants.ts` → `TETO_TOTAL_ALUGUEL` | fonte da verdade no app |
| `tests/unit/scope.test.ts` | trava: nenhum `total` acima de 3.500, e `total` fecha com a soma |
| `data/coleta/merge.py` → `MAX_TOTAL_ALUGUEL` | choke point: nada acima entra na base |
| `scripts/coleta/coleta.mjs` → `--teto-total` (default 3500) | descarta antes de gastar cota e baixar foto |

O teste `test_expansao_dentro_do_escopo_da_leva` (S008) travava `rent <= 3000`.
Passou a travar `total <= 3500`, que é a regra nova.

## A poda

23 imóveis removidos de `lib/data.ts`, verificados um a um. Faixa do excesso:
14 entre R$ 3.501 e 4.000, 4 entre 4.001 e 5.000, 5 acima de 5.000.

Efeito colateral honesto: **Centro Cívico ficou vazio** (os 2 passingravam do teto
por condomínio) e Mercadoês/São Francisco seguem com 1 cada. A base ficou com
55×2 quartos e 9×3, em 32 bairros, 32 deles nos 8 bairros prioritários.

## Supply: os portais esgotaram

Quatro coletas nos mesmos 8 bairros, com cota alta, e o scraper reencontrou os
mesmos anúncios: das 30 formações da última rodada, só **7 eram genuinamente
novas** (o resto `ID-JA-EXISTE` ou o mesmo imóvel nos dois portais). O estoque
de 2 quartos ≤ R$ 3.500 all-in nesses bairros está praticamente esgotado. Subir
cota não rende nada — o corte que vale é o all-in, não a cota.

## Navegador logado (`--cdp`)

`--cdp=http://127.0.0.1:9222` faz o scraper usar um Chromium **já aberto e logado**
em vez do perfil próprio. Só o perfil próprio existia para passar do Cloudflare;
com a sessão real (`zapAccessToken`, `z_user_id`) a coleta fica mais estável.

Para usar:
```powershell
taskkill /IM chrome.exe /F
& "$env:LOCALAPPDATA\Chromium\Application\chrome.exe" --remote-debugging-port=9222 --profile-directory="Profile 1"
```
No modo CDP o script **não fecha** o navegador (só a aba que ele abriu).

## OLX: destravado, mas fora por falta de preço confiável

Três coisas estavam erradas e foram consertadas:

1. A URL de busca de categoria (`pr.olx.com.br/…/imoveis/aluguel/apartamentos`)
   **redireciona para a home**. A que funciona é `olx.com.br/estado-pr?q=`.
2. O card aponta para `…/imoveis/<slug>-<id>`, não `/vi/<id>`. O filtro antigo
   procurava `/vi/` e não achava nada.
3. O `ld+json` do anúncio **não tem `Product`**, só `RentAction` sem URL. A guarda
   lia `prod.url` e reprovava 100% dos anúncios. Passou a ler `link[rel=canonical]`.

Depois disso a coleta traz 49 anúncios por página e o filtro de bairro/cidade
funciona. **Mas o preço não é confiável**: o `h1` vem vazio e o parse por texto
acerta em parte dos anúncios e erra em outros — saíram `Batel 87m² R$ 50` e
`Centro 75m² R$ 90`, ambos duplicados, junto de `Batel 62m² R$ 2.800` corretos.
O preço real está num elemento com classe específica, que exige seletor exato.

Decisão: **fora da base**. Preço errado no app é pior que falta de anúncio.

## AC

1. [x] Nenhum imóvel com `total` acima de R$ 3.500 — travado em teste.
2. [x] `total` fecha com aluguel + condomínio + IPTU (mesma trava).
3. [x] Fotos: `node scripts/audit-photos.mjs` → **PASS (0 erros, 0 órfãs)**.
4. [x] 253 fotos órfãs da poda apagadas (15,3 MB); `public/imoveis` sem lixo.
5. [x] `vitest` 138/138, `typecheck`, `lint`, `build` e `playwright` 25/25 verdes.

## Correção de testes que era bug latente

`e2e/antidores.spec.ts` fixava `moving-estimate` em `"R$ 1.000 – R$ 1.800"`, quando o
próprio comentário acima dizia que o valor deriva do total e muda a cada leva.
Virou regex, igual ao `entry-estimate` ao lado.

`e2e/kanban.spec.ts` semeava follow-up em `zap-portao-124-5525`, que a poda removeu
(total 5.700) — o selo "sem retorno" sumia sem que nada do produto mudasse. Passou a
usar `zap-agua-verde-96-0258`, que existe na base.

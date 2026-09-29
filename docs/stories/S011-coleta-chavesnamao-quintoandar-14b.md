# S011 — Chaves na Mão + Quinto Andar nos 14 bairros-alvo (leva 12)

- **Type:** Config/Data · **Data:** 29/09/2026 · **Base:** `lib/data.ts` 89 → **152**
- **Complementa** S008 (4 portais), S009 (bairros prioritários) e S010 (teto all-in).
- **ADR:** ADR-005 (teto 3600, import por link, auth sem Postgres, `OPEN_ACCESS`).

> **Colisão de numeração, não resolvida aqui.** O `docs/ADR-003-filtros-avancados.md`
> e o `docs/regression-suite.md` referenciam S009/S010/S011/S012 como se fossem da
> lane de filtros, mas `docs/stories/S009` e `S010` são da lane de coleta. Arquivos
> mandam na prosa: S011 é livre. **Decisão pendente:** ou a ADR-003 passa a citar
> "S0NN (lane filtros)" para não colidir, ou a lane de filtros ganha prefixo.

## O que entrou

Dois portais novos, ambos coletados com `fetch` puro — **nenhum dos dois precisa de
navegador logado**, ao contrário de Zap/VivaReal/Apolar. O `--cdp` segue existindo
para os portais antigos, mas não foi usado nesta leva.

| Portal | Bruto | Passou o filtro | Telefone |
|---|---|---|---|
| Chaves na Mão | 1.050 (14 bairros × 5 páginas) | **64** → 63 mantidos | **64/64 (100%)** |
| Quinto Andar | 336 ids (14 slugs × 24) | 220 vettidos → **7** | **0/7 (0%)** |

### Chaves na Mão — a fonte que vale

`https://www.chavesnamao.com.br/imoveis-para-alugar/pr-curitiba/<bairro>/` com
`?pg=1..5`. O `robots.txt` só libera `pg=2..5` e barra `/*?*`, então a leva para
deliberadamente em 5 páginas: 75 anúncios por bairro, 1.050 no total.

| Bairro | passou | Bairro | passou |
|---|---|---|---|
| Portão | 13 | São Francisco | 4 |
| Cristo Rei | 9 | Bigorrilho | 4 |
| Cabral | 8 | Batel | 3 |
| Água Verde | 7 | Mercês | 3 |
| Rebouças | 5 | Centro | 2 |
| — | — | Alto da Glória | 2 |
| Centro Cívico | **0** | Alto da Rua XV | **0** |

Centro Cívico e Alto da Rua XV zeraram **por motivo real, não por parser**: todos os
candidatos eram all-in de R$ 3.730 a R$ 5.381. Conferido um a um nos descartes.

Achado que muda a régua: **o telefone vem em 100% dos anúncios**, no campo
`publisher.cellphone` do payload. Não precisa clicar "mostrar telefone", então
**esta leva não registra lead em painel nenhum** — o que a torna limpa por padrão,
ao contrário do que a ADR-004 precisou negociar com imobiliárias.

### Quinto Andar — roda, mas o teto é do portal

`https://www.quintoandar.com.br/alugar/imovel/<bairro>-curitiba-pr-brasil/`.
Rendimento de **3,1%** (7 de 219 únicos), e é teto estrutural, não bug:

1. **Não pagina.** 19 variações de parâmetro testadas (`?page=2`, `?offset=24`,
   `?limit=100`, `?sort=`, `?zoom=`, `/page/2/`…), todas devolvem o mesmo lote. O
   payload do servidor só tem a chave `"0"`. Teto duro de ~24 por slug.
2. **`visibleHouses.total` (56 a 181) é contagem do mapa**, não do que se raspa. Usar
   como meta de coleta é erro de planejamento.
3. **O perfil do anúncio não bate com o produto.** 64 `StudioOuKitchenette` e 23 `Casa`
   contra 133 `Apartamento`. Studios de 24–32m² morrem em `quartos`/`area`.
4. **Batel é inatingível: 0 de 24.** Os 2–3 quartos lá vão de R$ 3.925 a R$ 9.397
   de all-in contra um teto de R$ 3.600.

O que ele faz bem e vale guardar: `fetch` puro sem Cloudflare, e a galeria é farta
(19 a 36 fotos nos 7 aprovados).

**Veredito: funcional para rodar, ruim para este render.** Não compensa tentar
paginar — já foi provado impossível.

### Não existe imobiliária para casar — e isso e o veredito final

A tentativa de pegar o telefone pela via das imobiliárias (como no ZAP) **falha por
construção, não por scraper quebrado**. `quintoandar.mjs:468` gravou
`houseInfo.displayId` num campo chamado `quintoAndarAnunciante`, e esse campo nunca
foi anunciante: o portal mostra "Imóvel 767747" na tela, e dois andares do mesmo
prédio têm `displayId` diferente (`892907800`/`207800`, `892907822`/`207822`).

O que a sondagem do payload de 7/7 imóveis mostra:

```
listings[0].listingRentModel.rentalAdministrator = "QUINTOANDAR"
```

O QuintoAndar é o **administrador do contrato**, não o anunciante. Do outro lado
está **pessoa física**: 3 de 7 publicam nome de `KEY_HOLDER` (quem tem a chave) e
4 de 7 não publicam nome nenhum. Zero CRECI no HTML, zero razão social,
`publisherWhatsapp: ""` em 7/7, `talkToAgentEnabled: false`.

Por isso o banco de 29 imobiliárias com CRECI (`imobiliarias-telefone.json`) e
inaplicável aqui: ele só tem razão social, e aqui não há razão social para casar.
`/imobiliaria/{id}/` **não existe** no QuintoAndar — existe no Zap e no VivaReal, e
por isso a via funcionou lá. `/parceiros` existe mas está em `Disallow` no robots.txt.

**Os 7 imóveis do Quinto Andar não foram mergeados, e as 14 fotos órfãs foram
apagadas.** Ficam `scripts/coleta/quintoandar.mjs` pronto e re-executável, caso o
teto do portal mude.

## O all-in do Quinto Andar tem 5 termos, não 3

Descoberta que muda o teto de qualquer imóvel vindo desse portal:

```
totalCost = rentPrice + condoPrice + iptu + tenantServiceFee + homeProtection
```

Verificado com **delta zero em 219 de 219** imóveis. Com os 3 termos do resto do
pipeline (`rent + condo + iptu`), todo imóvel deste portal sairia **~4% abaixo** do
all-in real — e passaria por um teto que não é o teto. Ver ADR-005.

## Armadilhas já pagas

1. **Soft-404 no Chaves na Mão.** URL errada devolve **HTTP 200 com zero anúncios**.
   Status HTTP não prova nada; a validação é `count > 0`. Nenhum soft-404 nesta leva
   (70/70 páginas devolveram 15 anúncios).
2. **`houseInfo` esqueleto no Quinto Andar.** Em ~4% dos detalhes (9 ocorrências nesta leva de 336 ids) o
   objeto existe mas vem `rentPrice=0, totalCost=0, bedrooms=0, area=0, photos=[]`.
   Passa por **qualquer** filtro de preço. O re-fetch resolveu **9/9** nesta leva. O pior caso,
   id `907800`, devolveu esqueleto 4/4 e so saiu no retry. Sem esse retry, o banco ganharia imóveis de R$ 0.
3. **O filtro de bairro do Quinto Andar é raio de mapa, não bairro.** Em Batel, 11 de
   24 vieram de outro bairro. O único campo confiável é `condominium.neighborhood` do
   **detalhe** — `address.neighborhood` mente, em 4 de 8 do slug Batel o prédio está
   em Água Verde/Centro/Rebouças e o anúncio se autodenomina Batel.
4. **A mistura de tipos é pior que o esperado.** De 1.050 links, 204 eram
   `sala-comercial`, 75 `ponto-comercial`, 53 `casa-comercial`, 14 `terreno-comercial`,
   4 `galpão`. Mais 228 de quartos fora de 2–3.
5. **O `NNNm²` do slug do Chaves na Mão é área TOTAL, não privativa** (Batel 110 no
   slug, 104 no payload). O app mostra a privativa.
6. **"Sem taxa de condomínio" é um terceiro estado**, distinto de ausente — é
   declaração de zero, não falta. Não pode virar `condoUnknown`.
7. **Retry de transporte é obrigatório.** `ECONNRESET` e falha de DNS local após ~75
   requests rápidos. Backoff exponencial.

## Correções que a leva exige

| # | Onde | O quê |
|---|---|---|
| 1 | `data/coleta/merge.py`, `data/coleta/generate.py` | `quintoAndarId` está no JSON mas não declarado em `PORTAL_ID_FIELDS` — sem isso não há detecção de colisão de id entre portais |
| 2 | `scripts/coleta/apolar-telefone.mjs:50` | `price_max: "R$ 3.500,00"` hardcoded. **Único ponto do pipeline ainda no teto velho**; `coleta.mjs:237`, `chavesnamao.mjs:80`, `quintoandar.mjs:68` e `merge.py:22` estão em 3600 |
| 3 | `tests/unit/scope.test.ts:9` | Teste chama `test_dados_teto_allin_3500_nunca_estourado` mas o corpo usa `TETO_TOTAL_ALUGUEL` (=3600). O nome mente e é o contrato que o próximo agente lê |
| 4 | `data/coleta/telefones-chavesnamao-l4.json` | O imóvel `chavesnamao-batel-104-3500` está na base com `phone: ""`, mas `ref 46288817` tem `+5541996361012` publicado. Cobertura real é **59/89**, não 58/89 |
| 5 | `data/coleta/cobertura.py:24` | `print("regionais cobertas:", ...)` conta as **desconhecidas** (o `if not r.startswith("??")` está invertido do que o rótulo afirma) |
| 6 | `app/api/import/imovel/route.ts` | 148 linhas de diff não commitadas. A decisão de arquitetura (navegador CDP opt-in vs `fetch` puro, porque a Vercel não tem navegador) está só num comentário de código |

## Documento que mente (corrige junto)

O `README.md` afirma em :58-59 que **"Telefone/e-mail não são coletados"**. Isso é
falso desde a ADR-004: **121 de 152** imóveis têm telefone, **64 distintos. Quem seguir o README
acha que o app não tem telefone e **reverte a ADR-004**.

Sobre a segurança, três coisas não estão em nenhum `docs/`, só em comentários de código:

- `OPEN_ACCESS = process.env.NEXT_PUBLIC_OPEN_ACCESS !== "0"` está **ligado por
  padrão**. Em qualquer deploy sem a env var, **qualquer visitante entra direto**.
- `NEXT_PUBLIC_APP_USER` / `NEXT_PUBLIC_APP_PASS` são `NEXT_PUBLIC_`, então o Next.js
  as embute no bundle do cliente. A senha está no JavaScript do site. **Não é barreira
  real** — é o modo de rodar em máquina local, não autenticação.
- `README.md:29` diz que a senha de dev é `admin`; a real é `curitiba2026`.

## AC

- [x] `python data/coleta/generate.py` rodado — `lib/data.ts` foi de 89 para **152**
- [ ] Telefone `46288817` aplicado; cobertura real da base é **121/152**, com **64 telefones distintos**
- [ ] `quintoAndarId` declarado em `PORTAL_ID_FIELDS`
- [ ] `apolar-telefone.mjs` no teto 3600, e o nome do teste em `scope.test.ts` corrigido
- [ ] `cobertura.py` conta as **cobertas**, e existe relatório de cobertura por bairro
- [ ] `README.md` corrigido: 89 → ~157 imóveis, telefone sim, 4 portais, teto 3600
- [ ] `docs/agents/domain.md:34` aponta a S011 como a leva mais recente, não a S010
- [ ] `manifesto-fotos.md` reflita a nova contagem de fotos
- [x] `node scripts/audit-photos.mjs` → **PASS, 0 erros, 0 órfãs** (152 imóveis, 152 pastas, 152 capas)
- [ ] `vitest`, `typecheck`, `lint`, `build` e `playwright` verdes
- [ ] Teto R$ 3.600 all-in intocado, sem exceção

## Fora de escopo

- Paginação do Quinto Andar — provada impossível
- Telefone no Quinto Andar — `houseInfo` não tem campo de contato nenhum e o botão é
  client-side. Só com browser + clique, a ~8s por imóvel, e **registrando lead**.
  Não vale enquanto o portal entregar 7 imóveis
- Repor Centro Cívico e Alto da Rua XV — zeraram por preço, não por supply
- Corrigir o drift de documentação que não é desta leva (ADR-003 × S009/S010, o
  `AGENTS.md` regra nº5 que contradiz a ADR-004 sobre lead registration)

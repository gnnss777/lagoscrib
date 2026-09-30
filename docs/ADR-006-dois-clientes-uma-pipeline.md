# ADR-006 — Dois clientes, uma pipeline: perfil como parâmetro e base por alias

- **Status:** aceito · **Data:** 30/09/2026
- **Complementa** ADR-001 (pipeline) e ADR-005 (teto 3600, import, auth sem Postgres).
- **Cobre:** o segundo cliente (`perfis.json` → `thais`), a leva 13 (S012).
- **Não substitui** ADR-005: o teto do dono continua R$ 3.600 em `lib/constants.ts`.

> Registra como dois clientes (perfis) convivem num app só. A decisão tem três
> partes — parâmetro no pipeline, alias no build, env com fail-loud no estado — e as
> três já estão no código. O sintoma que isto evita é o mesmo da ADR-005: um agente
> novo lê `docs/`, vê um ternário num `pool.ts`, e "simplifica" de volta.

## O problema

Uma base, um teto, um conjunto de bairros, um dono. O segundo cliente precisa de
**casas 3+ quartos, teto all-in R$ 8.000, qualquer bairro** — a S012 inteira. As
três formas óbvias de resolver são as três erradas:

| opção | por que não |
|---|---|
| **fork do repo** | duplica 152 imóveis, fotos e pipeline; o dono passa a manter duas bases, e elas divergem na segunda leva |
| **dois apps** | o produto é o mesmo; o que muda é o parâmetro de entrada |
| **teto e tipo em env no app** | env é escolha de **runtime**, e a base é 23 imóveis × 11 fotos. Embutir as duas é o problema, não a solução |

## 1. Perfil é parâmetro do pipeline, não um fork

`data/coleta/perfis.json` é a declaração única de cada perfil; `data/coleta/perfis.py`
é o loader. Todo o resto pergunta ao perfil em vez de ter constante hardcoded:

```json
"dono":  { "dir": "data/coleta", "data": "lib/data.ts",       "tetoAllin": 3600, "fotos": "public/imoveis",      "fontes": ["zap","viva","olx","apolar","imobiliarias"] },
"thais": { "dir": "data/thais",   "data": "lib/data-thais.ts", "tetoAllin": 8000, "fotos": "public/imoveis-thais", "fontes": ["chavesnamao"] }
```

Consumidores que aceitaram `--perfil=`:

| arquivo | papel |
|---|---|
| `data/coleta/merge.py` | teto, filtro de tipo/quarto, dedup |
| `data/coleta/generate.py` | escreve o `data` declarado no perfil |
| `data/coleta/download.py` | baixa as fotos em `fotos` do perfil |
| `scripts/audit-photos.mjs` | confere capa + galeria por perfil |
| `scripts/coleta/coleta.mjs` | `--tipo` / `--teto` / `--min-quartos` / `--max-quartos` / `--saida` |

**Default é o dono, e isso é verificável, não prometido.** Rodar a pipeline sem
`--perfil=` produz `lib/data.ts` **byte a byte idêntico** ao anterior — conferido por
hash do arquivo gerado e do `merge-normalizado.json`. Sem isso, "adicionar um perfil"
seria um commit que muda a base de produção, e ninguém notaria até os ids mudarem.

O `--tipo` no coletor é a peça que a leva da S012 provou necessária: a URL de casa do
Zap/VivaReal é um **palpite** (`scripts/coleta/coleta.mjs:335`), então o coletor
precisa poder receber o tipo como argumento em vez de ter `apartamento` escrito no
corpo.

## 2. A base entra por ALIAS no build — e o ternário em runtime não funciona

Esta é a parte que custou mais e é a que **não** se deve desfazer.

### A tentativa que foi revertida

Primeiro foi `lib/pool.ts` com ternário em cima de env pública:

```ts
process.env.NEXT_PUBLIC_BASE_ARQUIVO === "thais" ? dataThais : data
```

**Não funciona, e o motivo não é que o ternário seja feio.** O Next.js só embute
`process.env.NEXT_PUBLIC_*` no bundle do cliente **quando a variável existe**. No
deploy do dono a env **não existe** — não há o que embutir — então o ternário não
vira constante de build, as **duas** bases entram no grafo, e o bundle do dono
carrega os 23 ids da Thaís junto dos 152. Um `NEXT_PUBLIC_*` ausente não é "o valor
default": é "ninguém sabe o que esse valor é em tempo de build".

### O que funciona

`lib/base.ts` reexporta de `@/lib/data`, e `next.config.js` troca o **destino do
alias** pelo arquivo do perfil:

```js
// next.config.js
turbopack: { resolveAlias: { "@/lib/base": BASE_ARQUIVO } }
```

O app consome `@/lib/base` em todo lugar. A base do outro perfil **não entra no
grafo de módulos** — não é eliminada em runtime, é que nunca é importada. Isso não
depende de a env existir.

### A prova, e por que ela é o gate

O comportamento não é observável pelo código, é observável pelo **bundle**. Por isso
o gate é um `grep` de ids dentro dos `.js` de `.next/static`:

| build | ids do dono | ids da Thaís |
|---|---|---|
| `NEXT_PUBLIC_PERFIL=thais` | **0** | **23** |
| sem env (dono) | **152** | **0** |

175 ids conferidos nos 12 arquivos `.js` de `.next/static`, **zero sobreposição** nos
dois sentidos. Sem esse grep, a mudança parece correta e não há como saber.

O **recibo** sai no log de todo build — `next.config.js:25`:

```
[base] perfil=thais -> ./lib/data-thais.ts
```

É a primeira coisa a olhar quando um deploy "serve a base errada".

### Consequência aceita: `next build --webpack` não é suportado

`resolveAlias` é do Turbopack. Um `next build --webpack` num deploy de perfil
serviria a base errada **em silêncio** — o build passaria, o site abriria, e o dono
veria a base da Thaís.

Foi por isso que o branch `--webpack` foi **removido** em vez de mantido com o alias
dentro: um alias que não funciona no modo suportado é pior que um erro. Se algum dia
alguém precisar de webpack, o caminho é um alias de `tsconfig` + `paths`, que
funciona nos dois bundlers — e aí o gate do `grep` tem que vir junto.

## 3. O estado do dono é separado por env, com fail-loud

Sinais de sincronização (notas, exclusões) não podem ser compartilhados entre os dois
clientes. `OWNER_STATE_KEY` saiu de `const` — que quebrava em runtime — e virou
função: `resolveOwnerStateKey()` em `lib/ownerState.ts:74`.

| entrada | resultado | por quê |
|---|---|---|
| env **ausente** | `lagoscrib:owner-state:v1` | é a chave **já existente** no Redis do dono. Preservar é o que faz o deploy do dono continuar enxergando o kanban dele sem migração |
| env **válida** | a chave da env | o segundo cliente em namespace próprio |
| env **setada e estragada** | **503**, e **não** cai no default | ver abaixo |

Estragada = vazia, com aspas em volta, acima de 256 caracteres, ou com caractere
fora de `[letras, números, : - _ . /]`. O `.env.local` escrito à mão
(`OWNER_STATE_KEY="cliente-b:owner-state"`) é o caso que produz a aspas.

**Por que 503 e não default.** O default é o namespace **do dono**. Herdar esse
namespace por causa de uma aspa é o pior resultado possível e é **silencioso**: o
segundo cliente passaria a ler e — pior — a **sobrescrever** o kanban do primeiro. Um
503 é feio e visível; uma sincronização cruzada é invisível e destrutiva. Falhar
fechado é a única escolha segura quando o erro é de configuração.

Sem Redis do segundo cliente o comportamento é o mesmo: `/api/owner-state` responde
503 e não há sync. **É feature desligada, não quebrada.**

O mesmo princípio já vale em `lib/redis.ts:29-31`, que tira aspas de env var depois
do bug das `NEXT_PUBLIC_APP_*` da ADR-005. Duas vezes o mesmo erro de env, dois
lugares que já não repetem.

## 4. Só o dado troca

Os dois arquivos gerados têm **schema idêntico**. Então `type Apartment` continua
saindo de `@/lib/data`, e os **~15 arquivos que importam só o tipo não mudaram**.
Se o schema divergisse, o alias do `next.config.js` não bastaria — o typecheck
quebraria em ambos os deploys.

Estado do dono que **não** foi parametrizado, por decisão: `AppContext`/auth
(`APP_USER`/`APP_PASS`) e as fotos do import por link
(`app/api/import/imovel/route.ts:30` ainda tem `const FOTOS = "public/imoveis"`
fixo). São pendências conhecidas, na S012.

## Deploy

Projeto Vercel `dungeonquest`, escopo `guilhermectps-projects`, plano Hobby, Node 24.x.

**Um 404 não prova que um domínio `.vercel.app` está livre.** A Vercel devolve 404
tanto para domínio inexistente quanto para domínio de outra conta — que é o que
acontece com `dungeonquest.vercel.app`: a API responde "already in use" e o
`domains inspect` diz que não há acesso. O nome está reservado em outra conta.

| domínio | estado |
|---|---|
| `dungeonquest.vercel.app` | **não pôde ser usado** — reservado em outra conta |
| `dungeonquest-alpha.vercel.app` | registrado como alias, mas **responde 404** |
| `dungeonquest-guilhermectps-projects.vercel.app` | **responde 200** |

**Bloqueio atual:** o projeto herdou **Deployment Protection** da conta, então o
deploy responde com a tela de login da Vercel (`<title>Login - Vercel</title>`) em
vez do app. Desligar em **Settings → Deployment Protection**, no painel.

| env | valor | por quê |
|---|---|---|
| `NEXT_PUBLIC_PERFIL` | `thais` | **seleciona a base** — é o switch do alias |
| `OWNER_STATE_KEY` | `thais:owner-state:v1` | namespace de sync próprio |
| `NEXT_PUBLIC_OPEN_ACCESS` | `0` | o bypass de login da ADR-005 **precisa** do prefixo `NEXT_PUBLIC_`: o `AppContext` é client component e não lê env de servidor |
| `OPEN_ACCESS` | `0` | a variável de servidor, pelo mesmo motivo |
| `APP_USER` | `thais` | |
| `APP_PASS` | valor do dono ⚠️ | ver aviso — **não** registrado aqui de propósito |
| `NEXTAUTH_SECRET` | novo | |

⚠️ **Senha fora deste arquivo, e o mesmo par nas duas contas.** O segundo cliente
foi provisionado com o mesmo par do dono, o que é aceitável em domínios
diferentes: um vazamento do par não abre o outro site, porque cada um tem
`NEXTAUTH_SECRET` próprio e o cookie de sessão é assinado por ele. O limite a
respeitar se um dia houver um terceiro cliente é esse: **par igual em contas
diferentes é o começo de um vazamento em cascata.** Gerar uma senha própria por
cliente é o certo, e este registro é o que lembra disso.

A senha não é escrita aqui de propósito: o repo é versionado, e um doc que
ensina a configurar um cliente não deve carregar a credencial dele. Fica na Vercel
(`APP_PASS` do projeto) e no `.env.local` da máquina do dono.

## O que estas decisões custaram

- **`next build --webpack` não funciona.** Consequência real e aceita: o build de
  deploy tem um modo só, e ele está no log (`[base] perfil=...`).
- **Uma regra que o próximo agente vai querer simplificar.** `resolveOwnerStateKey`
  tem validação de env que parece exagerada e quase ninguém escreve à mão. Ela existe
  porque o erro é silencioso e destrutivo (ver seção 3).
- **Ferramentas que não foram parametrizadas.** `manifesto.py` e `validar_bairros.py`
  ainda apontam para `data/coleta/merge-normalizado.json` fixo. O `AGENTS.md` manda
  rodar o `manifesto.py` para conferir cobertura de telefone, então **não há
  relatório de cobertura para o segundo cliente**. É a pendência mais relevante que
  sobrou: um gate que o segundo cliente não pode rodar é um gate que não existe.
- **Um perfil novo não é gratuito.** Exige a entrada no `perfis.json`, uma pasta de
  fotos e conferir os 4 consumidores de `--perfil=`. Não exige fork, o que era o
  ponto.

## Fora de escopo

- **Redis do segundo cliente.** Exige login no console do Upstash. Sem ele: 503,
  sem sync.
- **Terceiro cliente / parametrizar `APP_USER`, `APP_PASS` e as fotos do import.** O
  par de credenciais é hoje por ambiente, não por perfil.
- **Migrar o `OWNER_STATE_KEY` do dono.** O default continua sendo a chave antiga de
  propósito; renomear seria migração de dado sem ganho.
- **Zap/VivaReal para o perfil `thais`.** Bloqueiam `fetch`, clicarem telefone registra
  lead, e os dois são o mesmo estoque (16 dos 22 ids do VivaReal da leva de
  apartamentos já no Zap). Detalhe na S012.
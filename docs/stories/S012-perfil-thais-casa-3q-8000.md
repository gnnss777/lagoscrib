# S012 — Perfil Thaís: casas 3+ quartos, teto R$ 8.000 (leva 13)

- **Type:** Config/Data · **Data:** 30/09/2026 · **Base nova:** `lib/data-thais.ts` 0 → **23**
- **Base do dono:** `lib/data.ts` 152 → **152**. `git diff lib/data.ts` **vazio**.
- **Complementa** S011 (Chaves na Mão) e ADR-005 (teto all-in, auth sem Postgres).
- **ADR:** ADR-006 (dois clientes, um app só — perfil por alias de build).

> **Numeração livre, confirmada.** Existem S001..S011 e ADR-001..ADR-005. A S012 e a
> ADR-006 não colidem. O aviso da S011 sobre ADR-003 × S009/S010 continua valendo e
> **não** foi resolvido aqui — é de outra lane.

## O pedido

O dono do app tem uma amiga, **Thaís**, que quer o mesmo produto com outro alvo:

| | dono | Thaís |
|---|---|---|
| tipo | apartamento | **casa** |
| quartos | 2–3 | **3 ou mais** |
| teto all-in | R$ 3.600 | **R$ 8.000** |
| bairros | 14 fixos | **qualquer um** |

All-in é `aluguel + condomínio + IPTU`, o mesmo corte de 3 termos da ADR-005 — e
mesmo assim o teto é de casa, não de apartamento: é o **orçamento dela**.

**Duas delimitações que ela mesma pôs, por WhatsApp, e que valem como regra de
pipeline:** não quer **sobrado**, e não quer **casa em condomínio**. A segunda é
resolvida por construção (ver "Por que `condoUnknown` em 23/23"); a primeira foi
cuspida pelo filtro de título e custou 17 imóveis que o slug deixaria passar.

## O que entrou

**Nada na base do dono.** As duas bases são arquivos gerados separados
(`lib/data.ts` e `lib/data-thais.ts`) e o default do pipeline continua sendo o dono,
byte a byte. Como os dois perfis convivem num app só está na **ADR-006**; aqui só
consta o resultado.

| | dono | Thaís |
|---|---|---|
| base | `lib/data.ts` | `lib/data-thais.ts` |
| imóveis | 152 | **23** |
| telefone preenchido | 121/152 | **23/23 (100%)** |
| fotos | 152 capas | **23 capas + 230 galeria = 253 WebP, 14,9 MB** |
| pasta | `public/imoveis` | `public/imoveis-thais` |
| all-in máximo | R$ 3.600 | **R$ 7.743** |
| `condoUnknown: true` | parcial | **23/23** |

## A base da Thaís — o funil inteiro

O Chaves na Mão é o **único** portal que publica telefone em 100% dos anúncios, no
campo `publisher.cellphone` do payload (achado da S011). Por isso esta leva roda com
`fetch` puro, **sem `--cdp=`**, e **não registra lead em painel nenhum**.

14 bairros × 5 páginas = 70 requests, **70 com HTTP 200**. A página 1 devolveu 15
anúncios nos 14 bairros; as páginas 2 a 5 devolveram 0, com a nota `sem anuncios`.
Ou seja: o estoque inteiro de `casa-para-alugar` nos bairros visitados é **210**.

| etapa | quedan | o que saiu |
|---|---|---|
| lido | **210** | 14 bairros × pg 1 (pg 2–5 zeradas) |
| descartado | **−185** | ver tabela abaixo |
| bruto | **25** | passou tipo + quartos + preço + bairro |
| duplicata | **−2** | mesmo endereço + área + quartos |
| **mantido** | **23** | em 11 bairros distintos |

Os 185 descartados, por motivo, todos registrados em
`data/coleta/descartados-chavesnamao-casa-3q-ate8000-l4.json`:

| motivo | n |
|---|---|
| aluguel acima de R$ 8.000 | 93 |
| quartos fora de 3+ | 30 |
| bairro do anúncio ≠ bairro da listagem | 28 |
| **título: sobrado** | **17** |
| **título: comercial** | **14** |
| all-in acima de R$ 8.000 | 3 |

**O teto é o que mais corta, e não por pouco:** 93 das 210 casas custam mais de R$
8.000 só de aluguel, antes de qualquer taxa. Casa em Batel/Água Verde no teto do
dono (R$ 3.600) seria zero imóvel.

As 2 duplicatas saíram com a chave `endereço + área + quartos`:

- `Rua Francisco Torres, 120, Centro` — 185m², 4 quartos — 2×
- `Rua Amadeu Do Amaral, 1076, Portão` — 90m², 3 quartos — 2×

Composição final: **13 de 3 quartos, 7 de 4, 3 de 5**, em 11 bairros. `total = rent +
condo + iptu` fecha em **23/23**.

### `condoUnknown: true` em 23/23 — e não é falha

O Chaves na Mão **não publica condomínio de casa**. O payload vem
`condominiumFee: "$undefined"` e a descrição diz `Condomínio: R$ 0`. Isso é um
estado real do portal, não dado faltando: `condo = 0` **e** `condoUnknown = true`.

A regra nº4 do `AGENTS.md` é "condo desconhecido = `0 + condoUnknown: true`, nunca
estimar", e ela existe exatamente para este caso. Como a Thaís não quer casa em
condomínio, o `0` também é a leitura correta do tipo de imóvel pedido.

## A armadilha do slug — o slug não garante o tipo

No Chaves na Mão, **`casa-para-alugar` no slug não quer dizer casa residencial.**
Um anúncio de "Casa **Comercial**" tem o mesmo slug.

Se a leva confiasse no slug, entrariam os 31 imóveis que o filtro de título barrou
(17 sobrado + 14 comercial). Só o slug não distingue "casa", "sobrado", "casa
comercial", "residencial e comercial".

**E o portal se contradiz internamente, o que impede usar qualquer slug como
verdade.** Nos 23 mantidos:

| onde o termo "sobrado" aparece | n |
|---|---|
| no slug do **link** do anúncio | **0/23** |
| no **título** | **0/23** |
| no slug do **link da foto, no portal** (`data/thais/chavesnamao.json` → `photoUrls`) | **21/23** |
| no **nome do arquivo em disco** (`public/imoveis-thais/`) | **0/253** |

A foto é o único lugar do payload onde o termo aparece, e ela é **remota**. O
`download.py` salva por id do imóvel, então o arquivo em disco é
`public/imoveis-thais/<id>.webp` — não há slug no nome. As 253 fotos em disco (23
capas + 230 galeria) seguem esse formato e nenhuma carrega "sobrado".

No payload, o portal nomeia a foto `...-casa-sobrado-para-alugar-5-quartos-...` de um
imóvel cujo anúncio é "Casa com 5 quartos para alugar" e cujo link é
`casa-para-alugar-...`. Ler isso como "é sobrado" derrubaria 21 dos 23 que passaram.
Ler o link como verdade também não serve, porque é o mesmo template do anúncio
comercial.

**Decisão: o filtro fica no título, que é o texto que o anunciante escreveu.** É o
mesmo campo que o `AGENTS.md` já tratava como título de anúncio, e é o que a
delimitação da Thaís descreve. O slug do anúncio diz `casa-para-alugar` nos 23
mantidos, mas é o mesmo template do anúncio comercial — e o slug da foto do mesmo
imóvel pode dizer `casa-sobrado`. Nenhum dos dois é texto do anunciante, então nenhum
dos dois pode servir de filtro: o filtro tem que olhar o **título**. O risco residual
— o título dizer "casa" e o imóvel ser sobrado — não aparece em nenhum campo do
anúncio, então **não é medido por script e só uma visita fecha**. Fica registrado
como risco aceito, não como bug corrigido.

## Por que só o Chaves na Mão

Três motivos medidos, não preferências.

**1. Zap e VivaReal bloqueiam `fetch` puro.** Ambos respondem **HTTP 403** — e o WAF
nega até o `robots.txt` e o `sitemap.xml`, então nem há como ler a política de
crawl por script. Só funciona com browser de sessão logada (`--cdp=`).

**2. Zap e VivaReal são o mesmo estoque.** Medido nos arquivos brutos da leva de
apartamentos: **16 dos 22 ids do VivaReal** (`viva-2q-ate3500-14b-l4.json`) já
estavam no Zap (`zap-2q-ate3500-14b-l4.json`). O segundo portal acrescenta **6**
anúncios que o primeiro não tinha. Um browser, seis anúncios a mais, e clique em
"mostrar telefone" registrando lead no painel da imobiliária: não fecha.

**3. A amostra de Zap/VivaReal não fecha o total.** O dono tem teto all-in de
R$ 3.600, então **nada acima disso nunca foi coletado** — e a base dele é toda do
path de apartamento, com 2 dos 152 anúncios dizendo "casa" no título. Casas acima de
R$ 8.000 all-in, que é o alvo da Thaís, **não têm amostra nenhuma**: o 403 impede
medir, e a leitura que existe é enviesada para baixo por construção. O número de
casas caras nos portais bloqueados não pode ser estimado a partir dela.

**Por que isso ainda é uma pendência e não um "não existe":** a URL de casa do Zap e
do VivaReal está como constante nomeada em `scripts/coleta/coleta.mjs:335`
(`pathZap: "casas"`, `pathViva: "casa"`) com aviso de que é **palpite não confirmado**
— o 403 impede verificar. O palpite segue o padrão de URL dos dois portais no perfil
de apartamento. Se um `--tipo=casa` logar "nenhuma URL de busca respondeu", o consome
está aí.

## Quinto Andar continua fora

`rentalAdministrator = "QUINTOANDAR"` em **7/7** (medido na S011, não reconferido
nesta leva). O portal é o **administrador do contrato**, não o anunciante: do outro
lado é pessoa física, sem CRECI e sem razão social. O telefone está atrás de botão
client-side e clicar registra lead.

**Imóvel sem telefone não serve para prospectão**, que é a função da base (regra nº2
do `AGENTS.md`). Fora.

⚠️ **Nuance que o portal do Chaves na Mão introduz:** ele sindica anúncios de
imobiliárias e do próprio QuintoAndar. Dos 23, **4 têm
`source: "Chaves na Mão · QUINTOANDAR"`**. Isso não é coleta direta no QuintoAndar —
é o Chaves na Mão republicando, e o Chaves na Mão **publica o telefone**, que é
justamente o que faltava na coleta direta. Não contradiz o veredito acima, mas
qualquer contagem por `source` precisa saber que "QuintoAndar" aparece aqui com um
sentido diferente do que tem no `quintoandar.mjs`.

## Duas ressalvas de dado que a contagem de telefone esconde

`phone` preenchido é **23/23**. Telefone **distinto** é **16**.

| telefone | imóveis |
|---|---|
| `+551150280245` | **4** |
| `+5541999511054` | 2 |
| `+554132731212` | 2 |
| `+5541991210405` | 2 |
| `+554132502000` | 2 |

Cinco números se repetem. O de 4× é exatamente o dos 4 anúncios
`Chaves na Mão · QUINTOANDAR` — um contato de intermediação, não 4 donos
distintos. **Para prospecção, 23 imóveis é 16 contatos.** A regra nº2 do `AGENTS.md`
conta campo preenchido, e por isso passa; quem prospectar tem de saber disso.

Não há como corrigir pela raiz sem ir no portal de cada imobiliária sindiciada, e
isso não estava no escopo.

## AC

- [x] `python data/coleta/generate.py --perfil=thais` rodado — `lib/data-thais.ts` foi
      de 0 para **23**
- [x] Base do dono **intocada** — `git diff lib/data.ts` vazio
- [x] Telefone **23/23**, 16 distintos (ressalva acima)
- [x] `total = rent + condo + iptu` fecha em **23/23**; all-in máximo **R$ 7.743**,
      teto de R$ 8.000 intocado
- [x] `condoUnknown: true` em **23/23**, `condo = 0` em 23/23
- [x] 0 sobrado, 0 comercial nos 23 (filtro de título)
- [x] `node scripts/audit-photos.mjs` → **PASS, 0 erros** nos dois perfis (152 e 23)
- [x] `tsc --noEmit` limpo, incluindo o `lib/data-thais.ts` gerado
- [x] `vitest` **187/187** (26 arquivos), `typecheck` e `lint` limpos
- [ ] Confirmar com a Thaís se sobrado **real** passou como "casa" (risco residual do
      filtro de título — precisa de visita, não de script)
- [ ] `manifesto.py` e `validar_bairros.py` com `--perfil` (hoje nem rodam no perfil
      dela)

## Fora de escopo

- **Zap/VivaReal para casas.** Bloqueiam `fetch`, clicarem telefone registra lead, e
  os dois são o mesmo estoque. Precisa de browser logado para confirmar a URL de
  casa, que hoje é palpite.
- **Paginar o Chaves na Mão.** Não há o que paginar: pg 2–5 vieram vazias nos 14
  bairros. O estoque de 210 é o estoque todo daquele recorte.
- **"Qualquer bairro de Curitiba" na prática cobriu 14 bairros.** A URL do Chaves na
  Mão é escopada por bairro, então "qualquer bairro" virou "os mesmos 14 do dono".
  Ver pendência.
- **Tirar sobrado do slug.** Não dá — nenhum slug é texto do anunciante. O slug do
  link diz `casa-para-alugar` nos 23 (0/23 com "sobrado") e o slug da foto no portal
  diz "sobrado" em 21 dos 23; o arquivo em disco (0/253) não carrega nenhum dos dois,
  porque o `download.py` salva por id do imóvel.
- **Distinguir contato de dono nos 4 anúncios do QuintoAndar.**
- **Redis do segundo cliente.** Precisa de login no console do Upstash.

## Pendências que sobraram desta leva

1. **`manifesto.py` e `validar_bairros.py` ainda com `data/coleta/merge-normalizado.json`
   fixo**, sem `--perfil`. Não rodam para a Thaís. O `AGENTS.md` manda rodar
   `manifesto.py` pra conferir a cobertura de telefone, então hoje não há relatório
   de cobertura para o segundo cliente.
2. **`app/api/import/imovel/route.ts:30`** — `const FOTOS = "public/imoveis"` está
   fixo. Num deploy do perfil da Thaís, o import por link gravaria foto no diretório
   do dono.
3. **Cobertura de bairros.** O pedido é cidade inteira; o executado é 14 bairros.
   Leva em 14 bairros novos é o caminho, se a Thaís quiser.
4. **Redis do segundo cliente não existe.** Sem ele `/api/owner-state` responde 503
   e não há sync — comportamento fail-closed, correto, mas é uma feature desligada.
5. **Deployment Protection ainda ligada** no projeto Vercel: o deploy responde a tela
   de login da Vercel em vez do app. Desligar em Settings → Deployment Protection.
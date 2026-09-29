# ADR-005 — Teto 3600, import por link, auth sem Postgres e sync

- **Status:** aceito · **Data:** 29/09/2026
- **Substitui:** nada. **Complementa** ADR-001 (pipeline) e ADR-004 (telefone).
- **Cobre:** commits `3925bfa6`, `21355d3d`, `55e8110f`, `15bc519c`, e a leva 12 (S011).

> Registra quatro decisões que já estão no código e não tinham registro nenhum.
> O sintoma era o mesmo: um agente novo lê `docs/`, não acha nada, e ou
> reverte a decisão ou inventa a feature de novo.

## 1. O teto all-in subiu de R$ 3.500 para R$ 3.600

O teto é R$ **3.600** com todas as taxas, não 3.500. Subiu em `lib/constants.ts`
para admitir um anúncio real do Chaves na Mão: Batel, 104m², 3 quartos,
R$ 3.500 + R$ 0 de condomínio + R$ 98 de IPTU = **R$ 3.598**.

**Decisão do dono**, com o motivo explícito: o critério é o all-in que cabe no
orçamento, não o round number. 3.500 era um corte arbitrário que cortava o imóvel
certo por R$ 98.

Onde mora o teto, e todos precisam concordar:

| lugar | papel |
|---|---|
| `lib/constants.ts` → `TETO_TOTAL_ALUGUEL` | fonte da verdade no app |
| `data/coleta/merge.py` → `MAX_TOTAL_ALUGUEL` | choke point: nada acima entra |
| `scripts/coleta/coleta.mjs` → `--teto-total` | descarta antes de baixar foto |
| `tests/unit/scope.test.ts` | trava: nenhum `total` acima do teto, e `total` fecha com a soma |

⚠️ `scripts/coleta/apolar-telefone.mjs` ficou no 3500 e precisa ser corrigido — é o
único ponto do pipeline com o teto velho. E o nome do teste
`test_dados_teto_allin_3500_nunca_estourado` mente: o corpo usa a constante.

### O all-in do Quinto Andar tem 5 termos

A fórmula `rent + condo + iptu` **não vale para o Quinto Andar**:

```
totalCost = rentPrice + condoPrice + iptu + tenantServiceFee + homeProtection
```

Delta zero em **220 de 220** imóveis medidos. Com 3 termos, todo imóvel deste portal
sairia ~4% abaixo do all-in real — e passaria por um teto que não é o teto. Se algum
dia o `merge.py` normalizar esse portal, ele tem de saber disso.

## 2. Import de imóvel colando o link

Existe o caminho "colar a URL do anúncio e o formulário se preenche":

- `lib/imovel-import.ts` — parser genérico de página única
- `app/api/import/imovel/route.ts` — a rota
- `AddApartmentForm.tsx` — o form
- `tests/unit/imovel-import.test.ts` — 7 testes

**Por que:** era a única forma de adicionar imóvel pela UI sem rodar leva. Continua
sendo útil para aquele anúncio que ninguém mais tem.

**Dois caminhos de leitura, e por quê.** A rota tem navegador CDP **opt-in** e
`fetch` puro como padrão. A Vercel não tem navegador, e carregar o Playwright
(devDependency) dentro da função estourava a requisição. Então: `CDP_URL` definido
usa o navegador, ausente usa `fetch`.

Consequência honesta: por `fetch` puro, **só o Chaves na Mão funciona.** Zap, VivaReal
e OLX bloqueiam sem navegador, e a rota avisa isso. E `writeFile(..., "public/imoveis/")`
não persiste na Vercel — o filesystem da função é efêmero. **Falta decidir** entre
Vercel Blob, ou assumir que em produção o import só devolve link.

## 3. Auth sem Postgres, com bypass ligado por padrão

`lib/auth.ts` assina uma sessão NextAuth de verdade com as credenciais legadas de
`lib/legacy-users.ts`, sem banco. Antes disso as rotas `/api/*` respondiam 401
porque não havia sessão nenhuma — o import por link estava morto em produção.

Isso destravou o import, e trouxe dois avisos que **precisam ser lidos como
segurança, não como autenticação**:

1. **`NEXT_PUBLIC_APP_USER` e `NEXT_PUBLIC_APP_PASS` são públicas.** O prefixo
   `NEXT_PUBLIC_` faz o Next.js embutir as duas no bundle do cliente. A senha está
   no JavaScript que qualquer pessoa lê. Não é barreira real. Serve para rodar em
   máquina local.
2. **O bypass de login está ligado por padrão:**
   `OPEN_ACCESS = process.env.NEXT_PUBLIC_OPEN_ACCESS !== "0"`. Sem a env var, o app
   abre direto no Dashboard. Foi decisão do dono (o app é público e a base é pública).
   Só a API exige sessão.

A senha de dev real é `curitiba2026` — o `README.md` diz `admin`, está errado.

## 4. Sync de estado entre aparelhos

`lib/ownerState.ts` + `app/api/owner-state/` + `lib/redis.ts` + `SyncGate.tsx`:
notas e exclusões do dono passam a sincronizar entre aparelhos via Upstash Redis,
autenticadas por `SYNC_TOKEN` (que **não** pode ser `NEXT_PUBLIC_`).

Regra que o código garante e a doc precisa dizer: **a carga sempre adota o servidor**
(commite `15bc519c`, correção de `55e8110f`), e a versão dos excluídos precisa bater.
Sem isso o cliente sobrescreve o servidor com estado velho.

O `README.md` ainda descreve o mundo como "localStorage para persistência", o que
parou de ser verdade quando o Redis entrou.

## O que estas decisões custaram

- **Complexidade de ambiente.** Dois caminhos de import (CDP e fetch) porque a Vercel
  não tem navegador. Se um dia o import só rodar no Chromium local, o caminho `fetch`
  pode ser removido.
- **Segurança de fachada.** Com o bypass ligado e as credenciais no bundle, o app não
  tem autenticação de verdade. Isso foi aceito conscientemente. Se um dia mudar, o
  caminho é `NEXT_PUBLIC_` → variável de servidor, e `OPEN_ACCESS` → `0`.
- **Um teto que já bugou uma vez.** 3.500 living num comentário e num nome de teste.
  Vale uma trava de CI que falhe se o teto aparecer hardcoded em dois lugares.

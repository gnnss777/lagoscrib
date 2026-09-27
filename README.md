# Curitiba Apartamentos - App de Gerenciamento

## Visão Geral

App web premium/minimalista para gerenciar apartamentos para alugar em Curitiba. Cards com valores completos, status de visita/negociação, notas e login simples.

## Stack

- **Next.js 15** + React 19 + TypeScript
- **Tailwind CSS v4** (paleta custom navy + dourado)
- **Motion** para animações
- **Phosphor Icons**
- **Geist + Geist Mono** (fontes)
- **LocalStorage** para persistência de dados

## Como Executar

```bash
cd C:/AI/apartamentos-app
npm install
npm run dev
```

Acesse: **http://localhost:3000**

## Credenciais de Login

Configuradas via ambiente — copie `.env.example` para `.env.local` (nunca commitado).
Padrões de dev local: usuário `guinness` / admin `admin`.

## Funcionalidades (MVP)

1. **Dashboard** - Grid de cards com foto, bairro, m², quartos, banheiros, vagas
2. **Card Expandido** - Valores (aluguel + condomínio + IPTU + total), contato, link original
3. **Status Workflow** - Não visitado → Agendado → Feita → Negociação → Aprovado/Recusado
4. **Notas** - Campo de texto por apartamento com timestamp, persistidas em localStorage
5. **Login Simples** - Autenticação local (1 usuário + senha)
6. **Design Premium** - Paleta navy (#0B1121) + dourado (#C8A66B) + branco (#F0F0F5), cards com gradiente e hover elegante

## Dados

**52 imóveis reais de aluguel** em Curitiba, coletados em 27/09/2026 (leva S008) de
3 portais: **Zap** (20), **VivaReal** (16) e **Apolar** (16). 33 de 2 quartos,
15 de 3 e 4 de 4+. Telefone/e-mail não são coletados (portais mascaram): o contato
é sempre pelo link do anúncio original.

O scraper é determinístico (sem LLM no loop) e versionado em
`scripts/coleta/coleta.mjs`; o histórico do pipeline em `docs/stories/S008-coleta-4-portais.md`.
O OLX ficou fora: a lista orgânica de anúncios não renderiza (ver a story).

Snapshot anterior (22/09/2026, 109 imóveis em 5 fontes) preservado em
`data/apartamentos.json` + `data/coleta/*.json`; fotos em `public/imoveis/`.

## Critérios de Aceitação

- [x] Página carrega e lista 8 cards com foto, bairro, quartos, m²
- [x] Card expandido mostra todos os valores (aluguel + condomínio + IPTU + total) e contato
- [x] Botão/status muda etapa (Não visitado → Agendado → Feita → Negociação → Aprovado/Recusado)
- [x] Notas salvas (texto + data) e persistentes em localStorage
- [x] Login básico funciona (usuários: guinness / admin)
- [x] Design com paleta consistente, sem em-dashes, sem Inter, com animações e ritmo

## Estrutura de Arquivos

```
app/
├── layout.tsx          # Root layout + AppProvider
├── page.tsx            # Home (Login ou Dashboard)
├── globals.css         # Estilos Tailwind + paleta
└── components/
    ├── LoginPage.tsx   # Tela de login premium
    ├── Dashboard.tsx   # Grid de cards + filtros
    ├── ApartmentCard.tsx  # Card individual
    └── DetailModal.tsx    # Modal de detalhes + notas
lib/
├── AppContext.tsx      # Estado global + auth + localStorage
└── data.ts             # Dados dos 8 apartamentos
```

## Comandos

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento (porta 3000) |
| `npm run build` | Build de produção |
| `npm start` | Servidor de produção |
| `npm run test` | Testes unitários (vitest) |
| `npm run typecheck` | `tsc --noEmit` |
| `node scripts/audit-photos.mjs` | Gate das galerias (≥8 fotos, WEBP, ≤350KB) |

## Coleta de imóveis (leva)

```bash
# 1. coletar (Edge real + perfil persistente; 8s por navegação, ~20 min)
node scripts/coleta/coleta.mjs --quartos=2,3 --qtd-zap=16 --qtd-viva=16 --qtd-apolar=18

# 2. normalizar, deduplicar e validar
python data/coleta/merge.py zap-23q-l4 viva-23q-l4 apolar-23q-l4
python data/coleta/validar_bairros.py

# 3. fotos (~15 min) e gate
python data/coleta/download.py
node scripts/audit-photos.mjs

# 4. injetar em lib/data.ts (idempotente) e manifestar
python data/coleta/generate.py
python data/coleta/manifesto.py
```

## Paleta de Cores (tema "Lightbox Analógico" — DESIGN.md v2.0)

| Cor | Hex | Uso |
|-----|-----|-----|
| Paper | #FAF9F6 | Fundo principal (papel creme) |
| Card | #FFFFFF | Cards, modais, inputs |
| Ink | #1A1A1A | Texto principal |
| Taxi | #F5C518 | Acentos e destaques (CTA, seleção, logo) |
| Ink-soft | #4B5563 | Texto secundário |
| Muted | #57534E | Placeholders e labels |

Contraste AAA em todo texto (≥ 7:1) — trava automatizada em `tests/unit/lightbox-contrast.test.ts`.

## Novidades (leva dores-consumidor — 22/09/2026)

- **Galeria completa**: todo imóvel com 11 fotos reais do anúncio, navegáveis com zoom.
- **Custo total de verdade**: aluguel + condomínio + IPTU somados, com estimativas de entrada e mudança (sempre rotuladas como estimativa).
- **Compra e aluguel**: aba Alugar | Comprar com 5 imóveis à venda de Curitiba.
- **Confiança**: selo de verificação com data e origem, botão Confirmar disponibilidade e aviso anti-golpe em todo contato.
- **Visita e comparação**: checklist de visita exportável (copiar/WhatsApp), planta quando divulgada e comparação lado a lado de até 4 imóveis.

- **Filtros avancados**: busque por quartos, banheiros, vagas, faixa de preco, area, condominio, mobiliado, pets e facilidades — com ordenacao (menor preco, maior area, mais recentes) e filtros salvos ao recarregar.
- **Comparativo com metragem**: cada coluna mostra titulo + m2 + preco.

## Novidades (leva lightbox-analogico — 22/09/2026)

- **Tema claro**: fundo papel creme com destaques em amarelo táxi — leitura mais confortável e cara de portal imobiliário.
- **Acessibilidade AAA**: todo texto com contraste ≥ 7:1 (antes, alguns textos secundários falhavam até o mínimo); foco visível em tinta preta em todo botão e campo.

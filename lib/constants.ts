// Constantes centralizadas da leva dores-consumidor (ADR-002 §5).
// REGRA: nenhum valor monetário/faixa/taxa hardcoded em componente —
// tudo aqui, com comentário da fonte. Hardcode fora = erro de review (LL-006).

// --- Precificação (S001) ---
// Casas decimais do preço/m² exibido (padrão dos portais: 1 casa, ex. R$ 3.577,8/m²).
export const PRICE_PER_M2_DECIMALS = 1;

// Locale/moeda do Intl.NumberFormat em toda a UI (DESIGN.md §7).
export const CURRENCY_LOCALE = "pt-BR";
export const CURRENCY_CODE = "BRL";

// --- Galeria (S003, DESIGN.md §4/§10, ADR-002 decisão 1) ---
// Níveis de zoom do lightbox (1x→2x→4x, cíclico). Componente só lê daqui.
// Teto da implementação própria: se ImageLightbox.tsx estourar ~250 linhas,
// trocar pelo fallback yet-another-react-lightbox (ADR-002).
export const GALLERY_ZOOM_LEVELS = [1, 2, 4] as const;
export const GALLERY_OWN_IMPL_MAX_LINES = 250;

// Teto do produto: R$ 3.600 com TODAS as taxas (aluguel + condomínio + IPTU).
// Subiu de 3.500 na leva 11 para admitir o anúncio do Chaves na Mão (R$ 3.598
// all-in: aluguel 3.500 + condomínio 0 declarado + IPTU 98). Sem folga além
// disso: o teto existe para o total caber no orçamento do usuário.
// Regra do usuário, não do portal: a busca dos coletores filtra só por aluguel,
// então sem isto a base aceita imóvel de R$ 2.500 com R$ 1.300 de condomínio.
// Travado em teste (tests/unit/scope.test.ts) e replicado em data/coleta/merge.py
// (MAX_TOTAL_ALUGUEL) e no scraper (--teto-total).
export const TETO_TOTAL_ALUGUEL = 3600;

// --- Anti-dores (S004, ADR-002 decisão 5) ---
// Fontes comentadas; componentes importam daqui (nunca hardcodar — LL-006).

// Caução padrão: 3 aluguéis (Lei do Inquilinato, art. 38 §1º — teto legal).
export const DEPOSIT_MONTHS = 3;

// Entrada estimada (aluguel) = 1º mês adiantado + caução.
// Faixa honesta: mín = 1× (fiador, sem custo inicial) → máx = (1 + caução)×.
export const ENTRY_MONTHS_MIN = 1;

// Seguro-fiança: 10–15% do aluguel anual ≈ 1,2–1,8 aluguel (faixa de mercado;
// ex.: o anúncio do Ed. Baêta de Faria cita "seguro fiança a partir de 10%").
export const GUARANTEE_FEE_ANNUAL_MIN_PCT = 10;
export const GUARANTEE_FEE_ANNUAL_MAX_PCT = 15;

// Mudança em Curitiba: faixas de carreto por nº de quartos (estimativa de
// mercado local 2026 — 3+ quartos R$ 1.000–1.800; sempre rotulada como estimativa).
export const MOVING_COST_RANGES = [
  { minRooms: 1, maxRooms: 1, min: 400, max: 800 },
  { minRooms: 2, maxRooms: 2, min: 700, max: 1200 },
  { minRooms: 3, maxRooms: 99, min: 1000, max: 1800 },
] as const;

// Rótulos da UI anti-dores (AC4: grep deve achar só aqui + importadores).
export const ESTIMATE_DISCLAIMER = "estimativa — confirmar com a imobiliária";
export const ENTRY_ESTIMATE_LABEL = "Entrada estimada";
export const MOVING_ESTIMATE_LABEL = "Mudança estimada";
export const GOLDEN_RULE =
  "Não pague nada antes de visitar o imóvel pessoalmente";

// Anti-ghost: 4 perguntas da mensagem de confirmação (UX spec F2/AC-WA-01).
export const WHATSAPP_QUESTIONS = [
  "O imóvel ainda está disponível para visita?",
  "Qual o valor atual do condomínio e da taxa de conservação?",
  "Qual o valor do IPTU, e ele é parcelado junto com o aluguel?",
  "Existe algum incentivo ou desconto para este anúncio?",
  "Quais seguros o imóvel exige (residencial, contra incêndio)?",
  "Aceitam seguro-fiador, e qual o custo? Ou é possível usar um fiador?",
  "Aceita pets?",
] as const;

// Checklist de visita (VisitChecklist): itens default, ids estáveis.
// Persistência versionada em AppContext (ADR-002 decisão 2).
// v3 (leva kanban-prospeccao): + followUps do corretor, mesma chave aditiva.
export const CHECKLIST_STORAGE_VERSION = 3;
export const CHECKLIST_ITEMS = [
  { id: "pressao-agua", label: "Pressão da água e aquecedor" },
  { id: "infiltracao", label: "Sinais de mofo e infiltração" },
  { id: "tomadas", label: "Tomadas e interruptores" },
  { id: "portas-janelas", label: "Portas, janelas e fechaduras" },
  { id: "barulho", label: "Barulho da rua e vizinhos" },
  { id: "vaga", label: "Vaga de garagem e acesso" },
  { id: "areas-comuns", label: "Áreas comuns do condomínio" },
  { id: "documentacao", label: "Documentação e garantia" },
] as const;

// --- Comparação (S005, ADR-002 decisão 4) ---
// Client-side, 2–4 imóveis, ordem default por custo total efetivo
// (aluguel: total all-in mensal; venda: preço). 5º bloqueado com aviso.
export const COMPARE_MIN = 2;
export const COMPARE_MAX = 4;

// --- Filtros avançados (S008, ADR-003) ---
// Faixas calibradas com 109 imóveis reais (22/09/2026, expansão 5 fontes):
// aluguel total 1.152–19.300 · venda 150.000–30.000.000 · área 21–874m² ·
// condomínio 0–4.300 (alguns "a confirmar"). Limites com folga p/ imóveis novos.
// REGRA (LL-006): UI lê daqui — nenhum literal de faixa em componente.

// Chave própria de persistência (nunca tocar "apartamentos-app-state").
export const FILTERS_STORAGE_KEY = "apartamentos-app-filters";
export const FILTERS_STORAGE_VERSION = 1;

// Debounce da persistência ao digitar (ms).
export const FILTER_DEBOUNCE_MS = 300;

// Debounce do push do estado do dono para o servidor (ms). Maior que o dos
// filtros: arrastar um card no kanban dispara vários updates seguidos e não
// vale um request por frame.
export const SYNC_DEBOUNCE_MS = 2500;

// Pull periódico do estado do dono (ms). O push é de um lado só: sem um pull
// recorrente, o aparelho que fica aberto nunca enxerga o que o outro mexeu, e o
// sintoma é "só vejo o que eu mexo, no meu PC". 20s é barato contra o rate
// limit da rota (60 req/min) e curto o bastante para não parecer quebrado.
export const SYNC_POLL_MS = 20_000;

// Valor "tanto faz" nos dropdowns de bairro.
export const NEIGHBORHOOD_ALL = "Todos";

// Opções "mín X+" (padrão de mercado; 0 = tanto faz, tratado na lógica).
export const BEDROOM_OPTIONS = [1, 2, 3, 4] as const;
export const BATHROOM_OPTIONS = [1, 2, 3, 4] as const;
export const PARKING_OPTIONS = [1, 2, 3] as const;

// Limites dos inputs numéricos (placeholders/validação — filtro aceita null).
// RENT_PRICE_BOUNDS.max subiu de 20k para 40k na leva 4: a base tem um
// apartamento de 442 m² a R$ 35.000 (total all-in R$ 39.700) e o slider não
// pode truncar o maior imóvel. Demais limites conferidos contra a base:
// área máx 442 (≤1000), condomínio máx 3.000 (≤5000).
export const RENT_PRICE_BOUNDS = { min: 0, max: 40000 } as const;
export const SALE_PRICE_BOUNDS = { min: 0, max: 35000000 } as const;
export const AREA_BOUNDS = { min: 0, max: 1000 } as const;
export const CONDO_MAX_BOUNDS = { min: 0, max: 5000 } as const;

// --- Slider de preço (leva kanban-tela-inteira-ui, AC-U4/U5) ---
// Substitui os inputs numéricos mín/máx por slider duplo. Lógica pura em
// lib/priceSlider.ts; componente só chama e renderiza (LL-006).
// Aluguel: linear 0–20k em 400 passos (R$50/passo — granularidade de portal).
// Venda: log 0–35M em 380 passos (pos 0 = R$0 "tanto faz"; pos ≥1 parte do
// piso PRICE_SLIDER_SALE_FLOOR — log(0) é indefinido, posição 0 cobre o zero).
export const PRICE_SLIDER_RENT_STEPS = 400;
export const PRICE_SLIDER_SALE_STEPS = 380;
export const PRICE_SLIDER_SALE_FLOOR = 50000;
export const PRICE_SLIDER_RENT_SCALE = "linear" as const;
export const PRICE_SLIDER_SALE_SCALE = "log" as const;

// Nomes acessíveis dos thumbs (AC-U6: getByRole("slider") distintos por aba).
export const PRICE_SLIDER_MIN_LABEL = "Preço mínimo";
export const PRICE_SLIDER_MAX_LABEL = "Preço máximo";

// Facilidades filtráveis, agrupadas p/ o painel. Calibradas com as features
// reais dos anúncios Zap (matching normalizado em lib/filters.ts —
// "9º andar com elevador" casa com "Elevador"; "SEM ELEVADOR" não casa).
export const FACILITY_GROUPS = [
  {
    group: "Condomínio",
    items: [
      "Elevador",
      "Portaria 24h",
      "Piscina",
      "Playground",
      "Salão de festas",
      "Academia",
      "Quadra",
      "Sauna",
    ],
  },
  {
    group: "Imóvel",
    items: [
      "Varanda",
      "Ar-condicionado",
      "Interfone",
      "Espaço gourmet",
      "Churrasqueira",
      "Lavanderia",
    ],
  },
] as const;

// Ordenação client-side (opera sobre a lista já filtrada).
export const SORT_OPTIONS = [
  { value: "recentes", label: "Mais recentes" },
  { value: "menor-preco", label: "Menor preço" },
  { value: "maior-preco", label: "Maior preço" },
  { value: "menor-preco-m2", label: "Menor preço/m²" },
  { value: "maior-area", label: "Maior área" },
] as const;

// --- Kanban de prospecção (leva kanban-prospeccao) ---
// Limiar do alerta "sem retorno há N+ dias" (dor #4: corretor não responde).
// Componentes leem daqui — nunca hardcodar (LL-006).
export const FOLLOWUP_STALE_DAYS = 7;

// Chave própria da customização de colunas (só UI/ordem — nunca estado do imóvel).
export const KANBAN_COLS_STORAGE_KEY = "apartamentos-app-kanban-cols";
export const KANBAN_COLS_STORAGE_VERSION = 2;

// Chave própria para ids de apartamentos removidos (estáticos ou new-*).
// v2 (leva 4, 27/09/2026): bump descarta a lista v1 com os 109 ids do snapshot
// 22/09/2026, já zerados de lib/data.ts. Sem isso, re-coletar um imóvel com o
// mesmo id continuaria invisível para sempre.
export const REMOVED_IDS_STORAGE_KEY = "apartamentos-app-removed";
export const REMOVED_IDS_STORAGE_VERSION = 2;

// Rótulos da UI do kanban (AC4: grep acha só aqui + importadores).
export const KANBAN_ONLY_STALE_LABEL = "Só sem retorno";
export const KANBAN_SHOW_ALL_LABEL = "Mostrar todos";
export const KANBAN_EMPTY_COLUMN_HINT = "Sem imóveis aqui — use ←/→ para mover um card";
export const KANBAN_CONTACT_LABEL = "Contatei";
export const KANBAN_RETURNED_LABEL = "Retornou ✓";
export const KANBAN_PROSPECT_LABEL = "Prospectar";
export const KANBAN_TAB_LABEL = "Prospecção";

// Modo de visualização (leva unificacao-busca-quadro): busca e quadro são o
// MESMO pool em duas formas de ver. O seletor fica no header e o modo atual é
// anunciado — trocar de modo não troca de tela, não abre modal e não perde o
// estado do outro modo.
export const VIEW_MODE_STORAGE_KEY = "apartamentos-app-view";
export const VIEW_MODE_STORAGE_VERSION = 1;
export const VIEW_BUSCA_LABEL = "Busca";
export const VIEW_QUADRO_LABEL = "Quadro";
export const VIEW_MODE_GROUP_LABEL = "Modo de visualização";
export const VIEW_MODE_ANNOUNCE: Record<ViewMode, string> = {
  busca: "Você está na busca: grade de imóveis com filtros.",
  quadro: "Você está no quadro de prospecção: imóveis por etapa do funil.",
};
export const QUADRO_HINT =
  "Mesmo pool da busca, agrupado por etapa do funil. Arraste os cards para mover de coluna.";
export type ViewMode = "busca" | "quadro";

// Fallback do board gerenciável: o excedente vira o rodapé "+N restantes".
// O cap cobre o pool padrão inteiro sem perder o fallback (LL-006).
export const KANBAN_VISIBLE_CAP = 200;

// --- Tema "Lightbox Analógico" (leva lightbox-analogico, DESIGN.md v2 §cores) ---
// REGRA (LL-006 estendido a design): nenhum hex de cor fora de THEME_PALETTE —
// globals.css (@theme) e componentes Tailwind consomem estes valores. Hex fora
// daqui = erro de review (invariante #2 do estúdio). Todos os pares texto/fundo
// foram medidos em 22/09/2026 e travados em tests/unit/lightbox-contrast.test.ts:
// texto normal ≥ 7:1 (AAA), UI/borda ≥ 3:1 (WCAG 2.2).
export const THEME_PALETTE = {
  // Superfícies claras
  paper: "#FAF9F6", // fundo do app (papel creme quente)
  card: "#FFFFFF", // cards, modais, inputs
  sand: "#F3E9D7", // pastel de apoio (badge "novo" — só com texto ink)
  // Tinta
  ink: "#1A1A1A", // texto principal (16.53:1 no paper)
  "ink-soft": "#4B5563", // texto secundário (7.18:1 no paper, 7.56 no card)
  muted: "#57534E", // placeholder/label (7.25:1 no paper, 7.63 no card)
  // Voz da marca: amarelo táxi (texto por cima é `on-accent` — que NESTE tema
  // é o mesmo `ink`; no escuro diverge, e é por isso que o token existe)
  taxi: "#F5C518", // CTA, seleção, logo (10.68:1 com ink/on-accent)
  "taxi-strong": "#E0B400", // hover do CTA (8.87:1 com ink/on-accent)
  pastel: "#FDF096", // chip/badge de destaque (14.99:1 com ink/on-accent)
  // Texto POR CIMA de um acento — o par `on-primary` de qualquer design system.
  // No tema CLARO os acentos são claros e a tinta é escura, então on-accent = ink
  // e nada muda na tela (zero diff visual no perfil `dono`). No tema escuro os
  // acentos continuam claros e a tinta é clara, então on-accent vira um tom
  // escuro: é o que salva os 5 pares de acento que o ink invertido quebraria
  // (medidos: ink #F0E6D2 sobre taxi #E8A317 = 1.75:1 — proibido).
  "on-accent": "#1A1A1A",
  // Pastéis de status (fundo + texto escuro calibrado, nunca só por cor)
  peach: "#FFE3D1",
  water: "#DDF3F0",
  amberink: "#5F4100", // links/texto âmbar (9.36:1 no card, 7.78 na sand)
  "st-blue-bg": "#DBEAFE",
  "st-blue": "#1E40AF", // 7.15:1 no próprio bg
  "st-purple-bg": "#F3E8FF",
  "st-purple": "#6B21A8", // 7.39:1 no próprio bg
  "st-green-bg": "#DCFCE7",
  "st-green": "#14532D", // 8.30:1 no próprio bg
  "st-red-bg": "#FEE2E2",
  "st-red": "#7F1D1D", // 8.20:1 no próprio bg
  // Linhas e foco
  line: "#E7E2D8", // hairline decorativa (nunca único indicador)
  inputbd: "#78716C", // borda de input (4.80:1 no card — piso UI 3:1)
  // Exceção foto: scrim escuro SÓ sobre imagens (legibilidade da foto,
  // padrão de portal; 18.81:1 com texto branco por cima)
  night: "#0B1121",
} as const;

export type ThemeToken = keyof typeof THEME_PALETTE;

// --- Tema "Dungeon Quest" (perfil `thais`) ---
// Mesmo conjunto de chaves do tema claro, MESMA direção de marca (âmbar de
// tocha) sobre pedra e noite. Escolhido em build-time por NEXT_PUBLIC_PERFIL
// (ver app/layout.tsx): os valores vão para o atributo `style` do <html>, e as
// 504 classes utilitárias (`bg-paper`, `text-ink`, `border-line`...) passam a
// resolver o token novo sem nenhuma classe precisar ser renomeada. Os hexes
// vivem AQUI e não em globals.css de propósito: o CSS é um arquivo só para os
// dois perfis, então um hex da dungeon em `@theme` entraria no bundle do dono.
// Todos os pares foram medidos com lib/contrast.ts e travados no mesmo teste do
// tema claro (texto ≥ 7:1, UI ≥ 3:1) — ver DESIGN.md §1.1.
export const THEME_PALETTE_DUNGEON: Record<ThemeToken, string> = {
  // Superfícies escuras: pedra e noite
  paper: "#0D0B08", // fundo do app (pedra quase preta)
  card: "#1A1611", // cards, modais, inputs (pedra levantada)
  sand: "#2A241C", // superfície de apoio (badge "novo" — só com texto ink)
  // Tinta clara (a tinta vira pergaminho, não breu)
  ink: "#F0E6D2", // texto principal (15.87:1 no paper)
  "ink-soft": "#C9BC9B", // texto secundário (10.44:1 no paper, 9.56 no card)
  muted: "#BCAE90", // placeholder/label (8.98:1 no paper, 8.22 no card)
  // Voz da marca: âmbar de tocha (texto SEMPRE on-accent por cima)
  taxi: "#E8A317", // CTA, seleção, logo (8.67:1 no night, 8.30 no card)
  "taxi-strong": "#CE9410", // hover do CTA (7.35:1 com on-accent)
  pastel: "#F2D9A0", // chip/badge de destaque (14.20:1 com on-accent)
  // Texto por cima do acento: tinta de breu (o `ink` claro daria 1.75:1 aqui)
  "on-accent": "#0F0B06",
  // Pastéis de status (fundo escuro + texto claro calibrado, nunca só por cor)
  peach: "#E8C3A4",
  water: "#BFD9D6",
  amberink: "#E0B878", // links/texto âmbar (9.68:1 no card, 8.26 na sand)
  "st-blue-bg": "#16233F",
  "st-blue": "#8FB6F5", // 7.56:1 no próprio bg
  "st-purple-bg": "#261B3D",
  "st-purple": "#C3A6F0", // 7.68:1 no próprio bg
  "st-green-bg": "#13291B",
  "st-green": "#77D69B", // 8.73:1 no próprio bg
  "st-red-bg": "#331618",
  "st-red": "#F5A19C", // 8.24:1 no próprio bg
  // Linhas e foco
  // `line` no escuro precisa de MAIS luminância que no claro: ele é o trilho do
  // slider de preço (`bg-line`, PriceRangeSlider) e é a única pista de borda do
  // card. Medido: 3.36:1 no paper / 3.07:1 no card — acima do piso de UI 3:1,
  // e ainda abaixo da `inputbd` (5.06:1) para a hierarquia de bordas ficar.
  line: "#6F6353",
  inputbd: "#948670", // borda de input (5.06:1 no card — piso UI 3:1)
  // Exceção foto: scrim SÓ sobre imagens (mesmo azul-noite do app/icon.svg)
  night: "#0B1121",
};

/**
 * Converte uma paleta no formato de custom properties do Tailwind (`@theme`),
 * para o atributo `style` do <html>. Só o perfil ativo recebe isso: o `dono`
 * fica com os valores do `@theme` de globals.css, sem toque nenhum.
 * Retorna um mapa (e não uma string) porque `style` do React só aceita objeto —
 * e objeto também é o que sobrevive ao SSR dentro do HTML.
 */
export function themeCssVars(
  palette: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(palette).map(([token, hex]) => [`--color-${token}`, hex]),
  );
}

// --- Identidade por perfil (mesmo app, dois clientes isolados) ---
// Escolhido em build-time por NEXT_PUBLIC_PERFIL (ver app/layout.tsx e
// next.config.js). `dono` é o default: sem a env, o comportamento é o de sempre.
export type AppProfile = "dono" | "thais";

export interface AppProfileMeta {
  appName: string;
  appTitle: string;
  appDescription: string;
  ogDescription: string;
  keywords: string[];
  // Domínio do contato do encarregado (LGPD art. 41) quando não há
  // PRIVACY_CONTACT_EMAIL no ambiente — o texto legal de um cliente não pode
  // citar a marca do outro (ver lib/privacy.ts).
  contactDomain: string;
}

export const APP_PROFILES: Record<AppProfile, AppProfileMeta> = {
  dono: {
    appName: "Lagoscrib",
    appTitle: "Lagoscrib — Curitiba Apartamentos: Aluguel e Venda",
    appDescription:
      "Curadoria de apartamentos em Curitiba para alugar e comprar: busca por bairro, filtros de facilidades, comparação lado a lado, estimativa de entrada/mudança e kanban de prospecção para acompanhar visitas e negociações.",
    ogDescription:
      "Curadoria de apartamentos em Curitiba para alugar e comprar, com comparação lado a lado e kanban de prospecção.",
    keywords: [
      "apartamentos Curitiba",
      "alugar apartamento Curitiba",
      "comprar apartamento Curitiba",
      "prospecção imobiliária",
      "kanban imóveis",
    ],
    contactDomain: "lagoscrib.local",
  },
  thais: {
    appName: "Dungeon Quest Igor e Thaís Tales",
    appTitle:
      "Dungeon Quest Igor e Thaís Tales — Curitiba Casas: Aluguel e Venda",
    appDescription:
      "Curadoria de casas em Curitiba para alugar e comprar: busca por bairro, filtros de facilidades, comparação lado a lado, estimativa de entrada/mudança e kanban de prospecção para acompanhar visitas e negociações.",
    ogDescription:
      "Curadoria de casas em Curitiba para alugar e comprar, com comparação lado a lado e kanban de prospecção.",
    keywords: [
      "casas Curitiba",
      "alugar casa Curitiba",
      "comprar casa Curitiba",
      "casas 3 quartos Curitiba",
      "Chaves na Mão",
    ],
    contactDomain: "dungeonquest.local",
  },
};

/** Perfil do deploy, lido da env pública (fallback = dono, o comportamento de sempre). */
export function resolveAppProfile(
  env: Record<string, string | undefined> = {},
): AppProfile {
  return (
    env.NEXT_PUBLIC_PERFIL ??
    env.NEXT_PUBLIC_BASE_ARQUIVO ??
    "dono"
  ) as AppProfile;
}

export interface ThemeContrastPair {
  fg: ThemeToken;
  bg: ThemeToken;
  floor: number;
  label: string;
}

// Texto normal: piso AAA (7:1). Cada par tem redundância de estado onde há cor
// (ícone/label/aria) — camada AAA existente do projeto, preservada.
//
// A lista é COMPARTILHADA pelos dois temas: todo par aqui tem de passar nas
// duas paletas. É por isso que o texto sobre acento é `on-accent` e nunca `ink`
// — `ink` é escuro no tema claro e claro no escuro, e nenhum dos dois valores
// funciona nos dois lados do acento.
export const THEME_CONTRAST_TEXT: ThemeContrastPair[] = [
  { fg: "ink", bg: "paper", floor: 7, label: "texto principal no fundo" },
  { fg: "ink", bg: "card", floor: 7, label: "texto principal no card" },
  { fg: "ink", bg: "sand", floor: 7, label: "texto no badge areia" },
  { fg: "ink-soft", bg: "paper", floor: 7, label: "texto secundário no fundo" },
  { fg: "ink-soft", bg: "card", floor: 7, label: "texto secundário no card" },
  { fg: "muted", bg: "paper", floor: 7, label: "placeholder no fundo" },
  { fg: "muted", bg: "card", floor: 7, label: "placeholder no card" },
  { fg: "on-accent", bg: "taxi", floor: 7, label: "texto no CTA táxi" },
  {
    fg: "on-accent",
    bg: "taxi-strong",
    floor: 7,
    label: "texto no hover do CTA",
  },
  { fg: "on-accent", bg: "pastel", floor: 7, label: "texto no chip pastel" },
  { fg: "on-accent", bg: "peach", floor: 7, label: "texto no pastel pêssego" },
  { fg: "on-accent", bg: "water", floor: 7, label: "texto no pastel água" },
  { fg: "amberink", bg: "card", floor: 7, label: "link âmbar no card" },
  { fg: "amberink", bg: "sand", floor: 7, label: "link âmbar na areia" },
  { fg: "amberink", bg: "paper", floor: 7, label: "link âmbar no fundo" },
  { fg: "st-blue", bg: "st-blue-bg", floor: 7, label: "badge agendado" },
  { fg: "st-purple", bg: "st-purple-bg", floor: 7, label: "badge visita feita" },
  { fg: "st-green", bg: "st-green-bg", floor: 7, label: "badge aprovado" },
  { fg: "st-red", bg: "st-red-bg", floor: 7, label: "badge recusado" },
  // Kanban (leva kanban-prospeccao): selo de retorno + alerta de coluna.
  { fg: "on-accent", bg: "pastel", floor: 7, label: "selo sem retorno no card" },
  { fg: "amberink", bg: "card", floor: 7, label: "alerta sem retorno na coluna" },
  // Status desenhado como TEXTO (não badge) sobre superfície do app:
  // VisitChecklist/KanbanBoard escrevem "ok"/"erro" direto no card e na areia.
  { fg: "st-green", bg: "card", floor: 7, label: "texto de ok no card" },
  { fg: "st-red", bg: "card", floor: 7, label: "texto de erro no card" },
  { fg: "st-green", bg: "sand", floor: 7, label: "texto de ok na areia" },
  { fg: "st-red", bg: "sand", floor: 7, label: "texto de erro na areia" },
];

// UI não-textual: piso WCAG 2.2 de componente gráfico (3:1).
export const THEME_CONTRAST_UI: ThemeContrastPair[] = [
  { fg: "inputbd", bg: "card", floor: 3, label: "borda de input" },
  { fg: "inputbd", bg: "paper", floor: 3, label: "borda de input no painel" },
  { fg: "ink", bg: "paper", floor: 3, label: "anel de foco no fundo" },
  { fg: "ink", bg: "card", floor: 3, label: "anel de foco no card" },
];

// UI do tema ESCURO só. Existe porque a pedra precisa de pistas visuais que o
// papel já dava de graça: `line` é o trilho do slider e a única borda do card,
// e o thumb do slider é um disco táxi dentro de uma pedra escura. No tema claro
// nenhum destes pares é problema (o contraste nasce da sombra e da borda
// escura), então a lista é do dungeon e não da compartilhada — botar `line`
// na lista comum reprovaria o dono em 1.23:1 sem poder consertá-lo sem mexer
// no visual dele.
export const THEME_CONTRAST_UI_DUNGEON: ThemeContrastPair[] = [
  { fg: "line", bg: "paper", floor: 3, label: "trilho do slider no fundo" },
  { fg: "line", bg: "card", floor: 3, label: "hairline no card" },
  { fg: "taxi", bg: "paper", floor: 3, label: "CTA e thumb do slider no fundo" },
  { fg: "taxi", bg: "card", floor: 3, label: "thumb do slider no card" },
  {
    fg: "on-accent",
    bg: "taxi",
    floor: 3,
    label: "anel do thumb sobre o disco táxi",
  },
];

// Pares proibidos pelo DESIGN.md v2 (documentados para ninguém reintroduzir).
// Lista do tema CLARO: a cor de superfície clara (`card` = branco) sobre acento
// quebra, porque o acento já é claro e a CTA leva tinta escura por cima.
export const THEME_FORBIDDEN_PAIRS: ThemeContrastPair[] = [
  // Branco sobre táxi = 1.63:1 — CTA leva tinta preta, sem exceção.
  { fg: "card", bg: "taxi", floor: 4.5, label: "branco sobre táxi (usar on-accent)" },
  {
    fg: "card",
    bg: "taxi-strong",
    floor: 4.5,
    label: "branco sobre táxi-strong (usar on-accent)",
  },
];

// Mesma proibição, medida na paleta escura. O token que quebra aqui é o
// `ink`: no tema dungeon a tinta é clara e o acento também, então ink sobre
// acento dá 1.75:1 (o bug que o `on-accent` existe para impedir). Já `card`
// (pedra) sobre acento DÁ contraste — por isso a lista é por tema, e não uma
// só: cada tema proíbe o seu próprio "texto errado" no acento.
export const THEME_FORBIDDEN_PAIRS_DUNGEON: ThemeContrastPair[] = [
  {
    fg: "ink",
    bg: "taxi",
    floor: 4.5,
    label: "tinta clara sobre táxi (usar on-accent)",
  },
  {
    fg: "ink",
    bg: "pastel",
    floor: 4.5,
    label: "tinta clara sobre pastel (usar on-accent)",
  },
];

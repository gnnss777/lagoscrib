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
  "Qual o valor atual do condomínio?",
  "Aceita pets?",
  "Quais garantias vocês aceitam (fiador, seguro-fiança ou caução)?",
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

// Valor "tanto faz" nos dropdowns de bairro.
export const NEIGHBORHOOD_ALL = "Todos";

// Opções "mín X+" (padrão de mercado; 0 = tanto faz, tratado na lógica).
export const BEDROOM_OPTIONS = [1, 2, 3, 4] as const;
export const BATHROOM_OPTIONS = [1, 2, 3, 4] as const;
export const PARKING_OPTIONS = [1, 2, 3] as const;

// Limites dos inputs numéricos (placeholders/validação — filtro aceita null).
export const RENT_PRICE_BOUNDS = { min: 0, max: 20000 } as const;
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

// Rótulos da UI do kanban (AC4: grep acha só aqui + importadores).
export const KANBAN_ONLY_STALE_LABEL = "Só sem retorno";
export const KANBAN_SHOW_ALL_LABEL = "Mostrar todos";
export const KANBAN_EMPTY_COLUMN_HINT = "Sem imóveis aqui — use ←/→ para mover um card";
export const KANBAN_CONTACT_LABEL = "Contatei";
export const KANBAN_RETURNED_LABEL = "Retornou ✓";
export const KANBAN_PROSPECT_LABEL = "Prospectar";
export const KANBAN_TAB_LABEL = "Prospecção";

// Trava física do board estático sem scroll (ESTÁTICO-SEM-SCROLL 23/09/2026):
// pílula ≈60px + gap 6px → 7 cabem em ~470px; + header/rodapé ≈ 590px,
// dentro dos ~592px úteis em 768p (100vh − header da view − toolbar).
// O resto vira o rodapé "+N restantes" (LL-006: sem mágica na UI).
export const KANBAN_VISIBLE_CAP = 7;

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
  // Voz da marca: amarelo táxi (texto sempre ink por cima — nunca branco)
  taxi: "#F5C518", // CTA, seleção, logo (10.68:1 com ink)
  "taxi-strong": "#E0B400", // hover do CTA (8.87:1 com ink)
  pastel: "#FDF096", // chip/badge de destaque (14.99:1 com ink)
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

export interface ThemeContrastPair {
  fg: ThemeToken;
  bg: ThemeToken;
  floor: number;
  label: string;
}

// Texto normal: piso AAA (7:1). Cada par tem redundância de estado onde há cor
// (ícone/label/aria) — camada AAA existente do projeto, preservada.
export const THEME_CONTRAST_TEXT: ThemeContrastPair[] = [
  { fg: "ink", bg: "paper", floor: 7, label: "texto principal no fundo" },
  { fg: "ink", bg: "card", floor: 7, label: "texto principal no card" },
  { fg: "ink-soft", bg: "paper", floor: 7, label: "texto secundário no fundo" },
  { fg: "ink-soft", bg: "card", floor: 7, label: "texto secundário no card" },
  { fg: "muted", bg: "paper", floor: 7, label: "placeholder no fundo" },
  { fg: "muted", bg: "card", floor: 7, label: "placeholder no card" },
  { fg: "ink", bg: "taxi", floor: 7, label: "texto no CTA táxi" },
  { fg: "ink", bg: "taxi-strong", floor: 7, label: "texto no hover do CTA" },
  { fg: "ink", bg: "pastel", floor: 7, label: "texto no chip pastel" },
  { fg: "ink", bg: "sand", floor: 7, label: "texto no badge areia" },
  { fg: "ink", bg: "peach", floor: 7, label: "texto no pastel pêssego" },
  { fg: "ink", bg: "water", floor: 7, label: "texto no pastel água" },
  { fg: "amberink", bg: "card", floor: 7, label: "link âmbar no card" },
  { fg: "amberink", bg: "sand", floor: 7, label: "link âmbar na areia" },
  { fg: "st-blue", bg: "st-blue-bg", floor: 7, label: "badge agendado" },
  { fg: "st-purple", bg: "st-purple-bg", floor: 7, label: "badge visita feita" },
  { fg: "st-green", bg: "st-green-bg", floor: 7, label: "badge aprovado" },
  { fg: "st-red", bg: "st-red-bg", floor: 7, label: "badge recusado" },
  // Kanban (leva kanban-prospeccao): selo de retorno + alerta de coluna.
  { fg: "ink", bg: "pastel", floor: 7, label: "selo sem retorno no card" },
  { fg: "amberink", bg: "card", floor: 7, label: "alerta sem retorno na coluna" },
];

// UI não-textual: piso WCAG 2.2 de componente gráfico (3:1).
export const THEME_CONTRAST_UI: ThemeContrastPair[] = [
  { fg: "inputbd", bg: "card", floor: 3, label: "borda de input" },
  { fg: "ink", bg: "paper", floor: 3, label: "anel de foco no fundo" },
  { fg: "ink", bg: "card", floor: 3, label: "anel de foco no card" },
];

// Pares proibidos pelo DESIGN.md v2 (documentados para ninguém reintroduzir).
export const THEME_FORBIDDEN_PAIRS: ThemeContrastPair[] = [
  // Branco sobre táxi = 1.63:1 — CTA leva tinta preta, sem exceção.
  { fg: "card", bg: "taxi", floor: 4.5, label: "branco sobre táxi (usar ink)" },
  {
    fg: "card",
    bg: "taxi-strong",
    floor: 4.5,
    label: "branco sobre táxi-strong (usar ink)",
  },
];

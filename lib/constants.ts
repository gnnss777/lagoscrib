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
export const CHECKLIST_STORAGE_VERSION = 2;
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
// Faixas calibradas com os 12 imóveis reais (22/09/2026):
// aluguel total 2.350–4.412 · venda 354.010–1.395.000 · área 66–140m² ·
// condomínio 0–1.778 (alguns "a confirmar"). Limites com folga p/ imóveis novos.
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
export const RENT_PRICE_BOUNDS = { min: 0, max: 10000 } as const;
export const SALE_PRICE_BOUNDS = { min: 0, max: 2000000 } as const;
export const AREA_BOUNDS = { min: 0, max: 1000 } as const;
export const CONDO_MAX_BOUNDS = { min: 0, max: 5000 } as const;

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

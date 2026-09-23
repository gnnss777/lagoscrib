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

8 apartamentos simulados (3 OLX + 2 VivaReal + 3 extras) com dados de Mercês, São Francisco, Centro, Vila Izabel, Portão, Água Verde, Batel e Cabral.

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

## Paleta de Cores

| Cor | Hex | Uso |
|-----|-----|-----|
| Navy 950 | #0B1121 | Fundo principal |
| Navy 900 | #0F1629 | Cards |
| Gold 400 | #C8A66B | Acentos e destaques |
| Surface 50 | #F0F0F5 | Texto primário |
| Surface 400 | #8A92A6 | Texto secundário |

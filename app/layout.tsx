import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/lib/AppContext";
import {
  APP_PROFILES,
  THEME_PALETTE_DUNGEON,
  resolveAppProfile,
  themeCssVars,
} from "@/lib/constants";
import { AuthProvider } from "./components/AuthProvider";
import MotionProvider from "./components/MotionProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Perfil do deploy (NEXT_PUBLIC_PERFIL, ou NEXT_PUBLIC_BASE_ARQUIVO — o mesmo
// `??` duplo do next.config.js). Sem env = `dono`, o comportamento de sempre.
// next.config.js já troca o DADO por este mesmo nome; aqui o mesmo nome troca a
// IDENTIDADE e a PALETA.
const perfil = resolveAppProfile(process.env);
const identidade = APP_PROFILES[perfil];

// Metadata por perfil: `Lagoscrib`/`apartamentos` no dono, o nome e o escopo do
// Dungeon Quest no perfil da Thaís. Título de página é identidade de cliente,
// não template — os dois textos são builds separados.
export const metadata: Metadata = {
  // F2.12 (polimento-ux-v2): título/description descrevem o app inteiro
  // (aluguel + venda + kanban de prospecção), não só "Aluguel".
  title: {
    default: identidade.appTitle,
    template: `%s · ${identidade.appName}`,
  },
  description: identidade.appDescription,
  applicationName: identidade.appName,
  keywords: identidade.keywords,
  authors: [{ name: "Gabriel" }],
  creator: "Gabriel",
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: identidade.appName,
    title: identidade.appTitle,
    description: identidade.ogDescription,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const backendEnabled = Boolean(
    process.env.DATABASE_URL && process.env.NEXTAUTH_SECRET,
  );
  // Só o perfil `thais` recebe a paleta escura, no atributo `style` do <html>:
  // assim as 504 classes utilitárias (`bg-paper`, `text-ink`, `border-line`…)
  // resolvem o token novo sem uma classe precisar ser renomeada, e o build do
  // `dono` não carrega nenhum hex da dungeon (globals.css é arquivo único e
  // compartilhado). `data-perfil` é o gancho dos overrides escopados do CSS.
  const temaStyle =
    perfil === "thais"
      ? (themeCssVars(THEME_PALETTE_DUNGEON) as CSSProperties)
      : undefined;
  return (
    <html lang="pt-BR" data-perfil={perfil} style={temaStyle}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <MotionProvider>
          <AppProvider>
            <AuthProvider enabled={backendEnabled}>{children}</AuthProvider>
          </AppProvider>
        </MotionProvider>
      </body>
    </html>
  );
}

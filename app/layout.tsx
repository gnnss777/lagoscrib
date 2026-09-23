import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/lib/AppContext";
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

export const metadata: Metadata = {
  // F2.12 (polimento-ux-v2): título/description descrevem o app inteiro
  // (aluguel + venda + kanban de prospecção), não só "Aluguel".
  title: {
    default: "Lagoscrib — Curitiba Apartamentos: Aluguel e Venda",
    template: "%s · Lagoscrib",
  },
  description:
    "Curadoria de apartamentos em Curitiba para alugar e comprar: busca por bairro, filtros de facilidades, comparação lado a lado, estimativa de entrada/mudança e kanban de prospecção para acompanhar visitas e negociações.",
  applicationName: "Lagoscrib",
  keywords: [
    "apartamentos Curitiba",
    "alugar apartamento Curitiba",
    "comprar apartamento Curitiba",
    "prospecção imobiliária",
    "kanban imóveis",
  ],
  authors: [{ name: "Gabriel" }],
  creator: "Gabriel",
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Lagoscrib",
    title: "Lagoscrib — Curitiba Apartamentos: Aluguel e Venda",
    description:
      "Curadoria de apartamentos em Curitiba para alugar e comprar, com comparação lado a lado e kanban de prospecção.",
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
  return (
    <html lang="pt-BR">
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

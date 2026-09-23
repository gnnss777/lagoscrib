import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/lib/AppContext";
import { AuthProvider } from "./components/AuthProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Curitiba Apartamentos - Gerenciamento de Aluguel",
  description: "App de gerenciamento de apartamentos para alugar em Curitiba",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const backendEnabled = Boolean(process.env.DATABASE_URL && process.env.NEXTAUTH_SECRET);
  return (
    <html lang="pt-BR">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AppProvider>
          <AuthProvider enabled={backendEnabled}>{children}</AuthProvider>
        </AppProvider>
      </body>
    </html>
  );
}

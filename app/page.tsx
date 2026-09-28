"use client";

import { useApp } from "@/lib/AppContext";
import LoginPage from "./components/LoginPage";
import Dashboard from "./components/Dashboard";
import { SyncGate } from "./components/SyncGate";

export default function Home() {
  const { isAuthenticated } = useApp();

  return (
    <>
      {isAuthenticated ? <Dashboard /> : <LoginPage />}
      {/* Fora da árvore da tela: o sync não é dado do app, é preferência de
          aparelho, e precisa existir nos dois modos. */}
      <SyncGate />
    </>
  );
}

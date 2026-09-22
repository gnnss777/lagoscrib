"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Key, Lock, User, X } from "@phosphor-icons/react";
import { useApp } from "@/lib/AppContext";

export default function LoginPage() {
  const { login } = useApp();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    // Simulate delay
    await new Promise((r) => setTimeout(r, 400));

    if (login(username, password)) {
      setError("");
    } else {
      setError("Usuário ou senha incorretos");
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      {/* Background: dois brilhos táxi suaves (conceito lightbox) */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-taxi/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-72 h-72 rounded-full bg-pastel/60 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        className="relative w-full max-w-md"
      >
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-taxi to-taxi-strong mb-4 shadow-lg"
          >
            <Key size={28} weight="bold" className="text-ink" />
          </motion.div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">
            Curitiba Apartamentos
          </h1>
          <p className="text-ink-soft mt-2 text-sm">
            Gerencie seus apartamentos em um só lugar
          </p>
        </div>

        {/* Login Card */}
        <div className="relative bg-card border border-line rounded-2xl p-8 shadow-xl">
          {/* Taxi top accent line */}
          <div className="absolute top-0 left-8 right-8 h-[2px] bg-gradient-to-r from-transparent via-taxi to-transparent" />

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-ink-soft uppercase tracking-wider mb-2">
                Usuário
              </label>
              <div className="relative">
                <User
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input-field pl-12"
                  placeholder="Digite seu usuário"
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-soft uppercase tracking-wider mb-2">
                Senha
              </label>
              <div className="relative">
                <Lock
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pl-12"
                  placeholder="Digite sua senha"
                  autoComplete="current-password"
                />
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 px-4 py-3 bg-st-red-bg border border-st-red/30 rounded-xl text-st-red text-sm"
              >
                <X size={16} weight="bold" />
                {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={isLoading || !username || !password}
              className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-ink/30 border-t-ink rounded-full animate-spin" />
              ) : (
                "Entrar"
              )}
            </button>
          </form>

          <p className="text-center text-xs text-muted mt-6">
            MVP Demo &bull; Dados locais
          </p>
        </div>
      </motion.div>
    </div>
  );
}

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
      {/* Background subtle gradient */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(200,166,107,0.05)_0%,transparent_50%)]" />

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
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-gold-400 to-gold-500 mb-4"
          >
            <Key size={28} weight="bold" className="text-navy-950" />
          </motion.div>
          <h1 className="text-2xl font-bold text-surface-50 tracking-tight">
            Curitiba Apartamentos
          </h1>
          <p className="text-surface-400 mt-2 text-sm">
            Gerencie seus apartamentos em um só lugar
          </p>
        </div>

        {/* Login Card */}
        <div className="relative bg-navy-900/80 border border-navy-700/50 rounded-2xl p-8 backdrop-blur-sm">
          {/* Gold top accent line */}
          <div className="absolute top-0 left-8 right-8 h-[1px] bg-gradient-to-r from-transparent via-gold-400/40 to-transparent" />

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">
                Usuário
              </label>
              <div className="relative">
                <User
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-500"
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
              <label className="block text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">
                Senha
              </label>
              <div className="relative">
                <Lock
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-500"
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
                className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm"
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
                <div className="w-5 h-5 border-2 border-navy-950/30 border-t-navy-950 rounded-full animate-spin" />
              ) : (
                "Entrar"
              )}
            </button>
          </form>

          <p className="text-center text-xs text-surface-500 mt-6">
            MVP Demo &bull; Dados locais
          </p>
        </div>
      </motion.div>
    </div>
  );
}

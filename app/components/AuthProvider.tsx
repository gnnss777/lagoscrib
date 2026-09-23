"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { useEffect, type ReactNode } from "react";
import { useApp } from "@/lib/AppContext";

/** Espelha a sessão NextAuth no AppContext (modo backend). */
function SessionBridge() {
  const { data: session, status } = useSession();
  const { setSessionUser } = useApp();

  useEffect(() => {
    if (status === "authenticated" && session?.user?.email) {
      setSessionUser(session.user.email);
    } else if (status === "unauthenticated") {
      setSessionUser(null);
    }
  }, [status, session, setSessionUser]);

  return null;
}

export function AuthProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  if (!enabled) return <>{children}</>;
  return (
    <SessionProvider>
      <SessionBridge />
      {children}
    </SessionProvider>
  );
}

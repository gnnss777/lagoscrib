import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { getDatabaseUrl } from "./db-url";
import { checkLoginAttempt, clearLoginAttempts, recordLoginFailure } from "./login-throttle";

declare module "next-auth" {
  interface User {
    role?: string;
  }
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role?: string;
    };
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) return null;

        const ip = request?.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
        const email = String(credentials.email).trim().toLowerCase();

        // Anti força bruta: após 5 falhas em 15 min, bloqueia 1 min por
        // (IP, e-mail). Falha silenciosa (mesmo retorno null do fluxo normal).
        const attempt = checkLoginAttempt(ip, email);
        if (!attempt.allowed) return null;

        const adapter = new PrismaPg({
          connectionString: getDatabaseUrl(),
        });
        const prisma = new PrismaClient({ adapter });

        const user = await prisma.user.findUnique({
          where: { email },
        });

        await prisma.$disconnect();

        if (!user || user.anonymizedAt) {
          recordLoginFailure(ip, email);
          return null;
        }

        const valid = await compare(credentials.password as string, user.password);
        if (!valid) {
          recordLoginFailure(ip, email);
          return null;
        }

        clearLoginAttempts(ip, email);

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as string;
        session.user.id = token.sub as string;
      }
      return session;
    },
  },
});

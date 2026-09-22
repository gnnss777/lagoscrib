import "dotenv/config";
import { defineConfig } from "prisma/config";

function cleanUrl(url: string | undefined): string {
  return (url || "").replace(/[?&]uselibpqcompat=true/g, "").replace(/\?$/, "");
}

export default defineConfig({
  migrations: {
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    url: cleanUrl(process.env.DIRECT_DATABASE_URL) || cleanUrl(process.env.DATABASE_URL),
  },
});

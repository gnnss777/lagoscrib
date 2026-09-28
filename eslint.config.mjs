import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Worktrees do proprio repo (oc/<tema>): tem .next proprio, que o
    // padrao acima nao alcanca porque o glob e ancorado na raiz.
    "oc/**",
  ]),
]);

export default eslintConfig;

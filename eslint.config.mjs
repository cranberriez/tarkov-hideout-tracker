import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/types/types",
              message: "Import from the canonical domain type module instead.",
            },
            {
              name: "@/app/(data)/_dataContext",
              message: "Use a route contract or lazy API controller instead.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/app/**/*.{ts,tsx}", "src/features/**/*.{ts,tsx}"],
    ignores: [
      "src/app/dev/**",
      "src/app/api/maps/**",
      "src/app/api/revalidate/route.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/server/services/**"],
              message: "Read Tarkov data through a repository-backed server query.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/types/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "react",
                "react/**",
                "@/features/**",
                "@/lib/stores/**",
                "@/server/**",
              ],
              message: "Canonical domain contracts cannot depend on UI, stores, or server implementations.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;

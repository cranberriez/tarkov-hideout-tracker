import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const directory = path.dirname(fileURLToPath(import.meta.url));

// One self-contained bundle: shared src/ pricing code, drizzle and pg are
// resolved from the repository root so the image needs no node_modules.
await build({
	entryPoints: [path.join(directory, "src/main.ts")],
	outfile: path.join(directory, "dist/worker.cjs"),
	bundle: true,
	platform: "node",
	target: "node22",
	format: "cjs",
	sourcemap: "linked",
	external: ["pg-native"],
	plugins: [
		{
			name: "catalog-memory-repository-only",
			setup(build) {
				// Preparation supplies its own in-memory repository. Do not bundle the
				// web-only fallback (Next caches and server-only) into this Node worker.
				build.onResolve({ filter: /^@\/server\/repositories\/tarkov-data\/postgres-repository$/ }, () => ({
					path: "web-repository",
					namespace: "worker-guard",
				}));
				build.onLoad({ filter: /.*/, namespace: "worker-guard" }, () => ({
					contents:
						'export function createPostgresRepository() { throw new Error("Catalog preparation must supply its in-memory repository"); }',
				}));
			},
		},
	],
	logLevel: "warning",
});

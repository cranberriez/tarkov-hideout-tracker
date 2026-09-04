import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { getTursoConfig, loadLocalEnv } from "./lib/config.mjs";
import { applySchema, createTursoClient } from "./lib/turso.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");

async function main() {
    await loadLocalEnv(projectRoot);
    const client = createTursoClient(getTursoConfig());
    try {
        await applySchema(client, path.join(scriptDirectory, "schema.sql"));
        process.stdout.write("Price storage is ready.\n");
    } finally {
        client.close();
    }
}

main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
});

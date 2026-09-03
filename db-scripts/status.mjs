import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { getTursoConfig, loadLocalEnv } from "./lib/config.mjs";
import { applySchema, createTursoClient } from "./lib/turso.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");

await loadLocalEnv(projectRoot);
const client = createTursoClient(getTursoConfig());
try {
    await applySchema(client, path.join(scriptDirectory, "schema.sql"));
    const result = await client.execute(`
        SELECT
            releases.mode,
            releases.release_id,
            releases.status,
            releases.generated_at,
            releases.uploaded_at,
            active.release_id = releases.release_id AS is_active,
            releases.record_counts_json
        FROM data_releases AS releases
        LEFT JOIN active_data_releases AS active ON active.mode = releases.mode
        ORDER BY releases.generated_at DESC, releases.mode
        LIMIT 30
    `);
    const rows = result.rows.map((row) => ({
        mode: String(row.mode),
        releaseId: String(row.release_id),
        status: String(row.status),
        active: Boolean(row.is_active),
        generatedAt: new Date(Number(row.generated_at)).toISOString(),
        uploadedAt: row.uploaded_at
            ? new Date(Number(row.uploaded_at)).toISOString()
            : null,
        counts: JSON.parse(String(row.record_counts_json)),
    }));
    process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
} finally {
    client.close();
}


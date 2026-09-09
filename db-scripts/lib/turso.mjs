import fs from "node:fs/promises";
import { createClient } from "@libsql/client";

export function createTursoClient(config) {
	return createClient(config);
}

export async function applySchema(client, schemaPath) {
	await client.executeMultiple(await fs.readFile(schemaPath, "utf8"));
}

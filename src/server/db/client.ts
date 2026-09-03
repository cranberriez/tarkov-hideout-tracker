import "server-only";

import { createClient, type Client } from "@libsql/client";
import { TursoConfigurationError } from "./errors";

let client: Client | null = null;

function requiredEnvironmentValue(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) throw new TursoConfigurationError(`${name} is not configured`);
    return value;
}

export function getTursoClient(): Client {
    if (client) return client;

    const url = requiredEnvironmentValue("TURSO_DATABASE_URL");
    const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
    if (url.startsWith("libsql:") && !authToken) {
        throw new TursoConfigurationError("TURSO_AUTH_TOKEN is not configured");
    }

    client = createClient({ url, ...(authToken ? { authToken } : {}) });
    return client;
}

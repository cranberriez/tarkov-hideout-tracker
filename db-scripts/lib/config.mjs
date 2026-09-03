import fs from "node:fs/promises";
import path from "node:path";

function parseEnvLine(line) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) return null;
    let value = match[2];
    if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
    ) {
        value = value.slice(1, -1);
    }
    return [match[1], value];
}

export async function loadLocalEnv(projectRoot) {
    for (const filename of [".env.local", ".env"]) {
        try {
            const contents = await fs.readFile(path.join(projectRoot, filename), "utf8");
            for (const line of contents.split(/\r?\n/)) {
                if (!line.trim() || line.trimStart().startsWith("#")) continue;
                const entry = parseEnvLine(line);
                if (entry && process.env[entry[0]] === undefined) {
                    process.env[entry[0]] = entry[1];
                }
            }
        } catch (error) {
            if (error?.code !== "ENOENT") throw error;
        }
    }
}

export function getTursoConfig() {
    const url = process.env.TURSO_DATABASE_URL?.trim();
    const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
    if (!url) {
        throw new Error("TURSO_DATABASE_URL is required in .env.local, .env, or the process environment");
    }
    if (!url.startsWith("file:") && !authToken) {
        throw new Error("TURSO_AUTH_TOKEN is required for a remote Turso database");
    }
    return { url, ...(authToken ? { authToken } : {}) };
}

export function parseModes(value) {
    const supported = new Set(["regular", "pve", "pvp-season"]);
    const modes = (value ?? "regular,pve,pvp-season")
        .split(",")
        .map((mode) => mode.trim())
        .filter(Boolean);
    if (modes.length === 0 || modes.some((mode) => !supported.has(mode))) {
        throw new Error("--modes must contain regular, pve, and/or pvp-season");
    }
    return [...new Set(modes)];
}


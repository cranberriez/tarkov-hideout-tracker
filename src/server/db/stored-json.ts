import { TursoDataIntegrityError } from "./errors";

export function parseStoredJsonValue<T>(value: unknown, label: string): T {
    if (typeof value !== "string") {
        throw new TursoDataIntegrityError(`${label} is not stored as JSON text`);
    }

    try {
        return JSON.parse(value) as T;
    } catch (error) {
        throw new TursoDataIntegrityError(
            `${label} contains invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
        );
    }
}

export function parseStoredJson<T>(value: unknown, label: string): T {
    const parsed = parseStoredJsonValue<T>(value, label);
    if (parsed === null || typeof parsed !== "object") {
        throw new TursoDataIntegrityError(`${label} JSON root is not an object`);
    }
    return parsed;
}

import { TursoDataIntegrityError } from "./errors";

export function parseStoredJson<T>(value: unknown, label: string): T {
    if (typeof value !== "string") {
        throw new TursoDataIntegrityError(`${label} is not stored as JSON text`);
    }

    try {
        const parsed: unknown = JSON.parse(value);
        if (parsed === null || typeof parsed !== "object") {
            throw new Error("JSON root is not an object");
        }
        return parsed as T;
    } catch (error) {
        throw new TursoDataIntegrityError(
            `${label} contains invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
        );
    }
}

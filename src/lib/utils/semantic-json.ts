type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nestedId(value: JsonRecord, key: string): string | null {
    const nested = value[key];
    return isRecord(nested) && typeof nested.id === "string" ? nested.id : null;
}

function stableArrayIdentity(value: unknown): string | null {
    if (!isRecord(value)) return null;

    for (const key of ["id", "itemId", "questId", "mapId", "traderId", "objectiveId"]) {
        if (typeof value[key] === "string") return `${key}:${value[key]}`;
    }
    for (const key of ["task", "trader", "map", "item", "quest", "objective"]) {
        const id = nestedId(value, key);
        if (id) return `${key}:${id}`;
    }
    return null;
}

function comparableArrayKey(value: unknown): string | null {
    if (
        value === null ||
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
    ) {
        return `${typeof value}:${JSON.stringify(value)}`;
    }
    return stableArrayIdentity(value);
}

/**
 * Produces a deterministic semantic representation for comparisons.
 *
 * Object property order never matters. Arrays are sorted only when every entry
 * is a primitive or has a stable domain identifier. Positional arrays such as
 * map geometry keep their original order.
 */
export function canonicalizeSemanticJson(value: unknown): unknown {
    if (Array.isArray(value)) {
        const canonicalEntries = value.map(canonicalizeSemanticJson);
        const keyedEntries = canonicalEntries.map((entry) => ({
            entry,
            key: comparableArrayKey(entry),
        }));
        if (keyedEntries.every(({ key }) => key !== null)) {
            return keyedEntries
                .sort((left, right) => {
                    const identityOrder = (left.key ?? "").localeCompare(right.key ?? "");
                    return identityOrder || JSON.stringify(left.entry).localeCompare(JSON.stringify(right.entry));
                })
                .map(({ entry }) => entry);
        }
        return canonicalEntries;
    }

    if (isRecord(value)) {
        return Object.fromEntries(
            Object.keys(value)
                .sort()
                .map((key) => [key, canonicalizeSemanticJson(value[key])]),
        );
    }

    return value;
}

export function semanticJsonEqual(left: unknown, right: unknown): boolean {
    return (
        JSON.stringify(canonicalizeSemanticJson(left)) ===
        JSON.stringify(canonicalizeSemanticJson(right))
    );
}

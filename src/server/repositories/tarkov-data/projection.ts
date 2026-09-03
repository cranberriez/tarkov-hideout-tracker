export function recordsByRequestedIds<T extends { id: string }>(
    records: readonly T[],
    ids: readonly string[],
): Record<string, T> {
    const requestedIds = new Set(ids);
    return Object.fromEntries(
        records
            .filter((record) => requestedIds.has(record.id))
            .map((record) => [record.id, record]),
    );
}

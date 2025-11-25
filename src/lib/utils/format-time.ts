export function formatUpdatedAt(timestamp: number | null): string | null {
    if (!timestamp) return null;
    try {
        return new Date(timestamp).toLocaleString(undefined, {
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return null;
    }
}

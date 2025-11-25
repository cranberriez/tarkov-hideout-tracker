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

export function formatRelativeUpdatedAt(timestamp: number | null): string | null {
    if (!timestamp) return null;
    try {
        const diffMs = Date.now() - timestamp;
        if (diffMs < 0) return "just now";

        const diffSec = Math.floor(diffMs / 1000);
        if (diffSec < 60) return "just now";

        const diffMin = Math.floor(diffSec / 60);
        if (diffMin < 60) return `${diffMin} min ago`;

        const diffHours = Math.floor(diffMin / 60);
        if (diffHours < 24) return `${diffHours} h ago`;

        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays} d ago`;
    } catch {
        return null;
    }
}

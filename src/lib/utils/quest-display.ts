export function hasDisplayQuestLevel(level: number | null | undefined): level is number {
    return typeof level === "number" && Number.isFinite(level) && level > 0;
}

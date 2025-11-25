export function normalizeName(name: string): string {
    return name
        .toLowerCase()
        .replace(/['"]/g, "")
        .replace(/[^a-z0-9\s-_]/g, "")
        .trim()
        .replace(/\s+/g, "-");
}

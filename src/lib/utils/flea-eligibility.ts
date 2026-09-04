export function isOnFleaMarket(types: readonly string[]): boolean {
    return !types.includes("noFlea");
}

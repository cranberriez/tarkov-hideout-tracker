export function formatNumber(num: number): string {
    if (num < 1000) {
        return num.toString();
    }

    if (num < 1000000) {
        const k = num / 1000;
        // If it's a whole number, don't show decimals. Max 4 total chars if possible, but logic:
        // 1000 -> 1k
        // 1500 -> 1.5k
        // 300000 -> 300k
        // 999999 -> 999.9k or 1M? User said 300,000 -> 300k.

        // Use maximumFractionDigits: 1 to get "1.5"
        return (
            k.toLocaleString("en-US", {
                maximumFractionDigits: 1,
            }) + "k"
        );
    }

    const m = num / 1000000;
    return (
        m.toLocaleString("en-US", {
            maximumFractionDigits: 1,
        }) + "M"
    );
}

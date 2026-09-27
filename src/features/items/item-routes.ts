export function itemHref(itemId: string) {
    return `/items/${encodeURIComponent(itemId)}`;
}

interface ItemUsageCompleteness {
    bartersError?: string;
    craftsError?: string;
    itemsError?: string;
    pricesError?: string;
    presentationError?: string;
}

export function isCompleteItemUsageData(data: ItemUsageCompleteness): boolean {
    return (
        !data.bartersError &&
        !data.craftsError &&
        !data.itemsError &&
        !data.pricesError &&
        !data.presentationError
    );
}

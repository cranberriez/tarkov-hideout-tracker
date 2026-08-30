interface ItemReference {
    item: string;
}

export function resolveItemReferences<TRequirement extends ItemReference, TItem>(
    requirements: readonly TRequirement[],
    itemsById: ReadonlyMap<string, TItem>,
    onMissing: (requirement: TRequirement) => void,
): Array<{ requirement: TRequirement; item: TItem }> {
    return requirements.flatMap((requirement) => {
        const item = itemsById.get(requirement.item);
        if (!item) {
            onMissing(requirement);
            return [];
        }
        return [{ requirement, item }];
    });
}

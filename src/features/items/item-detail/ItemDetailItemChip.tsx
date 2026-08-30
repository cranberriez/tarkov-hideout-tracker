import type { ReactNode } from "react";

interface ItemDetailItemChipProps {
    item: {
        name: string;
        iconLink?: string;
        gridImageLink?: string;
    };
    quantityLabel?: string;
    badges?: ReactNode;
    className?: string;
}

export function ItemDetailItemChip({
    item,
    quantityLabel,
    badges,
    className = "",
}: ItemDetailItemChipProps) {
    const imageLink = item.iconLink ?? item.gridImageLink;
    return (
        <span
            className={`flex min-h-11 max-w-52 items-center gap-2 rounded-[4px] bg-white/[0.035] px-2 py-1.5 text-xs ${className}`}
        >
            {imageLink && (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center">
                    <img src={imageLink} alt="" className="h-8 w-8 object-contain" />
                </span>
            )}
            <span className="min-w-0 max-w-36 truncate text-muted-foreground">{item.name}</span>
            {quantityLabel && (
                <span className="shrink-0 font-mono font-semibold text-foreground">
                    {quantityLabel}
                </span>
            )}
            {badges}
        </span>
    );
}

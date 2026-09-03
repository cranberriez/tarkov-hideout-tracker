import type { ReactNode } from "react";

interface ItemDetailItemChipProps {
    item: {
        id?: string;
        name: string;
        iconLink?: string;
        gridImageLink?: string;
    };
    quantityLabel?: string;
    badges?: ReactNode;
    secondary?: ReactNode;
    className?: string;
    onClick?: () => void;
}

export function ItemDetailItemChip({
    item,
    quantityLabel,
    badges,
    secondary,
    className = "",
    onClick,
}: ItemDetailItemChipProps) {
    const imageLink = item.iconLink ?? item.gridImageLink;
    const content = (
        <>
            {imageLink && (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center">
                    <img src={imageLink} alt="" className="h-8 w-8 object-contain" />
                </span>
            )}
            <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex min-w-0 items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">{item.name}</span>
                    {quantityLabel && (
                        <span className="shrink-0 font-mono font-semibold text-foreground">
                            {quantityLabel}
                        </span>
                    )}
                </span>
                {secondary && <span className="mt-0.5 flex items-center">{secondary}</span>}
            </span>
            {badges}
        </>
    );

    if (onClick) {
        return (
            <button
                type="button"
                onClick={onClick}
                className={`flex min-h-11 max-w-52 items-center gap-2 rounded-[4px] bg-white/[0.035] px-2 py-1.5 text-left text-xs transition-colors hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-tarkov-green ${className}`}
                aria-label={`Open details for ${item.name}`}
            >
                {content}
            </button>
        );
    }

    return (
        <span
            className={`flex min-h-11 max-w-52 items-center gap-2 rounded-[4px] bg-white/[0.035] px-2 py-1.5 text-xs ${className}`}
        >
            {content}
        </span>
    );
}

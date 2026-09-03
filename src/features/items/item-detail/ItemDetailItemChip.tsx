import type { ReactNode } from "react";

interface ItemDetailItemChipProps {
    item: {
        id?: string;
        name: string;
        iconLink?: string;
        gridImageLink?: string;
    };
    quantityLabel?: string;
    quantityOverlay?: boolean;
    badges?: ReactNode;
    secondary?: ReactNode;
    className?: string;
    onClick?: () => void;
}

export function ItemDetailItemChip({
    item,
    quantityLabel,
    quantityOverlay = false,
    badges,
    secondary,
    className = "",
    onClick,
}: ItemDetailItemChipProps) {
    const imageLink = item.iconLink ?? item.gridImageLink;
    const content = (
        <>
            {imageLink && (
                <span className="relative flex h-11 w-11 shrink-0 items-center justify-center">
                    <img src={imageLink} alt="" className="h-11 w-11 object-contain" />
                    {quantityOverlay && quantityLabel && (
                        <ItemQuantityBadge label={quantityLabel} />
                    )}
                </span>
            )}
            <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex min-w-0 items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-foreground/80">{item.name}</span>
                    {quantityLabel && !quantityOverlay && (
                        <span className="shrink-0 font-mono text-xs font-semibold text-foreground">
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
                className={`flex min-h-12 max-w-52 items-center gap-1.5 rounded-[4px] bg-white/[0.035] px-1.5 py-1 text-left text-[13px] transition-colors hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-tarkov-green ${className}`}
                aria-label={`Open details for ${item.name}`}
            >
                {content}
            </button>
        );
    }

    return (
        <span
            className={`flex min-h-12 max-w-52 items-center gap-1.5 rounded-[4px] bg-white/[0.035] px-1.5 py-1 text-[13px] ${className}`}
        >
            {content}
        </span>
    );
}

export function ItemQuantityBadge({ label }: { label: string }) {
    return (
        <span className="absolute -bottom-1 -right-1 inline-flex min-w-5 items-center justify-center rounded bg-background px-1.5 py-0.5 font-mono text-xs font-bold leading-none text-foreground shadow-sm ring-1 ring-white/15">
            {label}
        </span>
    );
}

import { CornerDownRight, Package } from "lucide-react";
import type { ReactNode } from "react";
import type { ItemSummary } from "@/types/items";
import { ItemQuantityBadge } from "./ItemDetailItemChip";

export function ItemDetailRecipeFlow({
    children,
    outputItem,
    outputCount,
}: {
    children: ReactNode;
    outputItem: Pick<ItemSummary, "name" | "iconLink" | "gridImageLink">;
    outputCount: number;
}) {
    const outputImageLink = outputItem.iconLink ?? outputItem.gridImageLink;

    return (
        <div className="mt-3">
            <div className="flex flex-wrap items-center gap-2">{children}</div>

            <div className="mt-2 flex min-h-12 w-full items-center gap-2.5 border-t border-white/[0.06] pt-2">
                <CornerDownRight
                    size={16}
                    className="ml-0.5 shrink-0 text-foreground/55"
                    aria-hidden="true"
                />
                <span className="relative flex h-11 w-11 shrink-0 items-center justify-center">
                    {outputImageLink ? (
                        <img
                            src={outputImageLink}
                            alt=""
                            className="h-11 w-11 object-contain"
                        />
                    ) : (
                        <Package size={18} className="text-muted-foreground" />
                    )}
                    <ItemQuantityBadge label={`${outputCount}`} />
                </span>
                <span className="flex min-w-0 flex-col">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground/70">
                        Output
                    </span>
                    <span className="truncate text-[13px] font-medium text-foreground">
                        {outputItem.name}
                    </span>
                </span>
            </div>
        </div>
    );
}

import { CornerDownRight, Package } from "lucide-react";
import type { ReactNode } from "react";
import type { ItemSummary } from "@/types/items";

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

            <div className="mt-1.5 flex min-h-10 w-full items-center gap-2 pl-4">
                <CornerDownRight
                    size={16}
                    className="ml-0.5 shrink-0 text-foreground/55"
                    aria-hidden="true"
                />
                <span className="font-mono text-base font-semibold text-white">
                    {outputCount} ×
                </span>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center">
                    {outputImageLink ? (
                        <img
                            src={outputImageLink}
                            alt=""
                            className="h-9 w-9 object-contain"
                        />
                    ) : (
                        <Package size={18} className="text-muted-foreground" />
                    )}
                </span>
            </div>
        </div>
    );
}

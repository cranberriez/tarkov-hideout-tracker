"use client";

import type { ReactNode } from "react";
import { FloatingPortal, useFloatingPreview } from "@/components/ui/floating-preview";
import { cn } from "@/lib/utils";

export type EntityTriggerProps = ReturnType<typeof useFloatingPreview>["triggerProps"];

/**
 * Rich hover/focus card around an entity link. The trigger stays a normal link
 * (click, middle-click, new tab); the card is informational and renders lazily.
 */
export function EntityPreview({
    renderPreview,
    disabled = false,
    className,
    children,
}: {
    renderPreview: () => ReactNode;
    disabled?: boolean;
    className?: string;
    children: (triggerProps: EntityTriggerProps) => ReactNode;
}) {
    const preview = useFloatingPreview({ disabled });
    return (
        <>
            {children(preview.triggerProps)}
            <FloatingPortal
                open={preview.open}
                floatingProps={preview.floatingProps}
                className={cn(
                    "w-80 max-w-[calc(100vw-16px)] rounded-md border border-highlight/15 bg-background p-3 text-left shadow-[0_18px_55px_color-mix(in_oklab,_var(--shadow)_80%,_transparent)]",
                    className,
                )}
            >
                {renderPreview()}
            </FloatingPortal>
        </>
    );
}

/** Label/value line inside a preview card. */
export function PreviewFact({ label, children }: { label: ReactNode; children: ReactNode }) {
    return (
        <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="text-subtle-foreground">{label}</span>
            <span className="min-w-0 text-right text-foreground">{children}</span>
        </div>
    );
}

export function PreviewFooter({ children }: { children: ReactNode }) {
    return <p className="mt-3 border-t border-highlight/8 pt-2 text-[10px] uppercase tracking-wider text-subtle-foreground">{children}</p>;
}

/** Default text-link styling for entity names in running content. */
export const entityLinkClassName =
    "rounded-xs underline decoration-highlight/30 underline-offset-4 transition-colors hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

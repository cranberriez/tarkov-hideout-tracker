import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Quiet uppercase heading shared by open detail layouts. */
export function SectionLabel({ children, className, as: Heading = "h2" }: { children: ReactNode; className?: string; as?: "h2" | "h3" }) {
    return (
        <Heading className={cn("mb-3.5 text-xs font-semibold uppercase tracking-[0.2em] text-subtle-foreground", className)}>
            {children}
        </Heading>
    );
}

interface DetailSectionProps {
    title: ReactNode;
    description?: ReactNode;
    /** Right-aligned header controls or summary values. */
    actions?: ReactNode;
    /** `bordered` renders a card with a divided header; `open` renders a label above flowing content. */
    variant?: "bordered" | "open";
    headingLevel?: "h2" | "h3";
    children: ReactNode;
    className?: string;
    bodyClassName?: string;
    id?: string;
}

export function DetailSection({
    title,
    description,
    actions,
    variant = "bordered",
    headingLevel = "h3",
    children,
    className,
    bodyClassName,
    id,
}: DetailSectionProps) {
    const Heading = headingLevel;
    if (variant === "open") {
        return (
            <section id={id} className={className}>
                <div className="mb-3.5 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <Heading className="text-xs font-semibold uppercase tracking-[0.2em] text-subtle-foreground">{title}</Heading>
                        {description && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>}
                    </div>
                    {actions && <div className="shrink-0">{actions}</div>}
                </div>
                <div className={bodyClassName}>{children}</div>
            </section>
        );
    }

    return (
        <section id={id} className={cn("bg-card/45", className)}>
            <div className="flex items-start justify-between gap-3 border-b border-border-color px-3 py-2.5">
                <div className="min-w-0">
                    <Heading className="text-sm font-semibold text-foreground">{title}</Heading>
                    {description && (
                        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{description}</p>
                    )}
                </div>
                {actions && <div className="shrink-0">{actions}</div>}
            </div>
            <div className={cn("p-3", bodyClassName)}>{children}</div>
        </section>
    );
}

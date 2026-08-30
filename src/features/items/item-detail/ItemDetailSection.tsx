import type { ReactNode } from "react";

interface ItemDetailSectionProps {
    title: string;
    description?: string;
    aside?: ReactNode;
    children: ReactNode;
    className?: string;
}

export function ItemDetailSection({
    title,
    description,
    aside,
    children,
    className = "",
}: ItemDetailSectionProps) {
    return (
        <section className={`bg-card/45 ${className}`}>
            <div className="flex items-start justify-between gap-3 border-b border-border-color px-3 py-2.5">
                <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                    {description && (
                        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                            {description}
                        </p>
                    )}
                </div>
                {aside && <div className="shrink-0">{aside}</div>}
            </div>
            <div className="p-3">{children}</div>
        </section>
    );
}

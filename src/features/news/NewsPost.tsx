import React from "react";

interface NewsPostProps {
    title: string;
    date: string;
    version: string;
    children: React.ReactNode;
}

export function NewsPost({ title, date, version, children }: NewsPostProps) {
    return (
        <section
            id={`v${version}`}
            className="flex flex-col gap-6 rounded-lg border bg-card p-5 scroll-mt-20 sm:p-7"
        >
            <div className="flex flex-col justify-between gap-2 border-b border-border/50 pb-4 sm:flex-row sm:items-end">
                <div className="flex flex-col gap-1">
                    <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                        {title}
                    </h2>
                    <span className="font-mono text-xs text-muted-foreground">v{version}</span>
                </div>
                <time className="text-xs font-medium text-muted-foreground sm:text-sm">{date}</time>
            </div>
            <div
                className={[
                    "flex flex-col gap-5 text-[15px] leading-7 text-foreground/85",
                    "[&_a]:font-medium [&_a]:underline-offset-4",
                    "[&_h3]:mt-5 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:leading-7",
                    "[&_li]:leading-7 [&_p]:leading-7",
                    "[&_ul]:space-y-2 [&_ul]:pl-5",
                ].join(" ")}
            >
                {children}
            </div>
        </section>
    );
}

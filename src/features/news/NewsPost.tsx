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
            className="flex flex-col gap-6 p-6 bg-card border rounded-lg scroll-mt-20"
        >
            <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-border/50 pb-4 gap-2">
                <div className="flex flex-col gap-1">
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">{title}</h2>
                    <span className="text-sm font-mono text-muted-foreground">v{version}</span>
                </div>
                <time className="text-sm text-muted-foreground font-medium">{date}</time>
            </div>
            <div className="flex flex-col gap-4 text-foreground/90 leading-relaxed">{children}</div>
        </section>
    );
}

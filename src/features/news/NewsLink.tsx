interface NewsLinkProps {
    title: string;
    version: string;
    date?: string;
    description?: string;
}

export function NewsLink({ title, version, date, description }: NewsLinkProps) {
    const href = `#v${version}`;

    return (
        <a
            href={href}
            className="block rounded-md border border-border/60 bg-card/60 hover:bg-card hover:border-border px-4 py-3 transition-colors"
        >
            <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex flex-col">
                    <span className="text-sm font-semibold text-foreground line-clamp-1">
                        {title}
                    </span>
                    <span className="text-[11px] font-mono text-muted-foreground">v{version}</span>
                </div>
                {date && (
                    <time className="text-[11px] text-muted-foreground whitespace-nowrap">
                        {date}
                    </time>
                )}
            </div>
            {description && (
                <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>
            )}
        </a>
    );
}

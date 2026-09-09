"use client";

import { createContext, useContext, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

interface DataLoadErrorProps {
    title?: string;
    messages: string[];
}

const RetryContext = createContext<(() => void) | null>(null);

export function DataQueryRetryProvider({ retry, children }: { retry: () => void; children: ReactNode }) {
    return <RetryContext.Provider value={retry}>{children}</RetryContext.Provider>;
}

export function DataRefreshError({ message }: { message: string }) {
    const retry = useContext(RetryContext);
    if (!retry) return null;
    return (
        <div role="alert" className="mx-auto mb-4 flex max-w-5xl items-center justify-between gap-3 rounded border border-danger/30 bg-danger-surface/30 px-4 py-2 text-sm text-danger">
            <span>{message}</span>
            <button type="button" onClick={retry} className="shrink-0 rounded border border-danger/30 bg-danger/10 px-2.5 py-1 text-xs font-semibold hover:bg-danger/20">Retry</button>
        </div>
    );
}

export function DataLoadError({
    title = "Some data is unavailable",
    messages,
}: DataLoadErrorProps) {
    const router = useRouter();
    const queryRetry = useContext(RetryContext);
    const uniqueMessages = [...new Set(messages)];

    return (
        <div
            role="alert"
            className="rounded border border-danger/30 bg-danger-surface/30 px-4 py-4 text-danger"
        >
            <div className="flex items-start gap-3">
                <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-danger" />
                <div className="min-w-0 flex-1">
                    <h2 className="font-semibold">{title}</h2>
                    {uniqueMessages.map((message) => (
                        <p key={message} className="mt-1 text-sm text-danger/80">
                            {message}
                        </p>
                    ))}
                    <p className="mt-2 text-xs text-danger/60">
                        Your saved progress is safe. This usually means the Tarkov data service is
                        temporarily unavailable or does not provide this game mode yet.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={queryRetry ?? (() => router.refresh())}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded border border-danger/30 bg-danger/10 px-2.5 py-1.5 text-xs font-semibold text-danger transition-colors hover:bg-danger/20"
                >
                    <RefreshCw aria-hidden="true" className="size-3.5" />
                    Retry
                </button>
            </div>
        </div>
    );
}

"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

interface DataLoadErrorProps {
    title?: string;
    messages: string[];
}

export function DataLoadError({
    title = "Some data is unavailable",
    messages,
}: DataLoadErrorProps) {
    const router = useRouter();
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
                    onClick={() => router.refresh()}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded border border-danger/30 bg-danger/10 px-2.5 py-1.5 text-xs font-semibold text-danger transition-colors hover:bg-danger/20"
                >
                    <RefreshCw aria-hidden="true" className="size-3.5" />
                    Retry
                </button>
            </div>
        </div>
    );
}

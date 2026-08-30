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
            className="rounded border border-red-400/30 bg-red-950/30 px-4 py-4 text-red-50"
        >
            <div className="flex items-start gap-3">
                <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-red-400" />
                <div className="min-w-0 flex-1">
                    <h2 className="font-semibold">{title}</h2>
                    {uniqueMessages.map((message) => (
                        <p key={message} className="mt-1 text-sm text-red-100/80">
                            {message}
                        </p>
                    ))}
                    <p className="mt-2 text-xs text-red-100/60">
                        Your saved progress is safe. This usually means the Tarkov data service is
                        temporarily unavailable or does not provide this game mode yet.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => router.refresh()}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded border border-red-300/30 bg-red-200/10 px-2.5 py-1.5 text-xs font-semibold text-red-100 transition-colors hover:bg-red-200/20"
                >
                    <RefreshCw aria-hidden="true" className="size-3.5" />
                    Retry
                </button>
            </div>
        </div>
    );
}

"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface DataRouteErrorProps {
    error: Error & { digest?: string };
    reset: () => void;
}

export default function DataRouteError({ error, reset }: DataRouteErrorProps) {
    useEffect(() => {
        console.error("Data page failed to render", error);
    }, [error]);

    return (
        <main className="container mx-auto px-6 py-16">
            <div
                role="alert"
                className="mx-auto max-w-2xl rounded border border-danger/30 bg-danger-surface/30 px-6 py-8 text-center text-danger"
            >
                <AlertTriangle aria-hidden="true" className="mx-auto size-8 text-danger" />
                <h1 className="mt-4 text-2xl font-bold">This data could not be loaded</h1>
                <p className="mt-2 text-sm text-danger/75">
                    Your saved progress is safe. The external Tarkov data service may be temporarily
                    unavailable or missing data for your active profile.
                </p>
                <button
                    type="button"
                    onClick={reset}
                    className="mt-5 inline-flex items-center gap-2 rounded border border-danger/30 bg-danger/10 px-4 py-2 text-sm font-semibold text-danger transition-colors hover:bg-danger/20"
                >
                    <RefreshCw aria-hidden="true" className="size-4" />
                    Try again
                </button>
            </div>
        </main>
    );
}

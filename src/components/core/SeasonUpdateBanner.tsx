import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";

export function SeasonUpdateBanner() {
    return (
        <aside
            aria-label="Tarkov 1.1 data warning"
            className="border-b border-warning/25 bg-warning/10"
        >
            <div className="container mx-auto flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6">
                <div className="flex items-start gap-2 text-sm text-warning sm:items-center">
                    <AlertTriangle
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0 text-warning sm:mt-0"
                    />
                    <p className="leading-5">
                        <span className="font-semibold">Hideout items and upgrades should be accurate for Tarkov 1.1.</span>{" "}
                        Quest data may be incomplete or inaccurate while we catch up.
                    </p>
                </div>
                <Link
                    href="/news#tarkov-1-1-transition"
                    className="ml-6 inline-flex w-fit shrink-0 items-center gap-1.5 rounded border border-warning/35 bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning transition-colors hover:bg-warning/20 sm:ml-0"
                >
                    Read update
                    <ArrowRight aria-hidden="true" className="size-3.5" />
                </Link>
            </div>
        </aside>
    );
}

import type { ReactNode } from "react";
import { AlertTriangle, Info, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Compact inline notice for empty or partial data. Page-level failures keep using
 * `DataLoadError`/`DataRefreshError`, which own retry behavior.
 */
export function DataNotice({
    tone = "warning",
    children,
    action,
    className,
}: {
    /** `warning`: partial/missing data. `info`: explanatory. `empty`: nothing to show. */
    tone?: "warning" | "info" | "empty";
    children: ReactNode;
    action?: ReactNode;
    className?: string;
}) {
    const Icon = tone === "warning" ? AlertTriangle : tone === "info" ? Info : Inbox;
    return (
        <div
            role={tone === "warning" ? "status" : undefined}
            className={cn(
                "flex items-start gap-2.5 rounded-sm border px-3 py-2 text-xs leading-relaxed",
                tone === "warning" && "border-warning/30 bg-warning/10 text-warning",
                tone === "info" && "border-info/25 bg-info/8 text-info",
                tone === "empty" && "border-dashed border-highlight/12 bg-transparent text-subtle-foreground",
                className,
            )}
        >
            <Icon aria-hidden="true" className="mt-px size-3.5 shrink-0" />
            <div className="min-w-0 flex-1">{children}</div>
            {action && <div className="shrink-0">{action}</div>}
        </div>
    );
}

"use client";

import { ArchiveRestore, CheckCircle2, Clock3 } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useUIStore } from "@/lib/stores/useUIStore";
import { cn } from "@/lib/utils";

export function LegacyProfileConversionCard() {
    const { deprecatedLegacyState, hasConvertedDeprecatedLegacyState, hasDismissedDeprecatedLegacyState } = useUserStore(
        useShallow((state) => ({
            deprecatedLegacyState: state.deprecatedLegacyState,
            hasConvertedDeprecatedLegacyState: state.hasConvertedDeprecatedLegacyState,
            hasDismissedDeprecatedLegacyState: state.hasDismissedDeprecatedLegacyState,
        })),
    );
    const openDialog = useUIStore((state) => state.setLegacyProfileConversionOpen);
    const hasLegacyData = deprecatedLegacyState !== null;
    const isOutstanding = hasLegacyData && !hasConvertedDeprecatedLegacyState;

    const status = hasConvertedDeprecatedLegacyState
        ? { label: "Converted", icon: CheckCircle2, tone: "border-tarkov-green/25 bg-tarkov-green/10 text-tarkov-green" }
        : hasDismissedDeprecatedLegacyState && hasLegacyData
          ? { label: "Not restored", icon: Clock3, tone: "border-white/15 bg-white/5 text-gray-400" }
        : isOutstanding
          ? { label: "Outstanding", icon: Clock3, tone: "border-amber-400/25 bg-amber-400/10 text-amber-200" }
          : { label: "No old data", icon: CheckCircle2, tone: "border-white/10 bg-white/5 text-gray-500" };
    const StatusIcon = status.icon;

    return (
        <div className="space-y-4 rounded-lg border bg-card p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium text-white">
                        <ArchiveRestore size={16} className="text-gray-500" />
                        Old profile data
                    </div>
                    <div className="max-w-md text-xs leading-5 text-gray-400">
                        Review and copy data saved before separate PVP, PVE, and KORD profiles were introduced.
                    </div>
                </div>
                <span className={cn("inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs", status.tone)}>
                    <StatusIcon size={13} />
                    {status.label}
                </span>
            </div>

            <button
                type="button"
                disabled={!hasLegacyData}
                onClick={() => openDialog(true)}
                className="inline-flex items-center rounded-md border border-foreground/30 bg-foreground/10 px-3 py-1.5 text-xs text-white transition-colors hover:bg-foreground/20 disabled:cursor-not-allowed disabled:opacity-40 sm:text-sm"
            >
                {hasConvertedDeprecatedLegacyState ? "Open conversion dialog again" : "Open conversion dialog"}
            </button>
        </div>
    );
}

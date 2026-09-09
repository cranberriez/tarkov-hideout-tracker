"use client";

import { CheckCircle2, Clock3 } from "lucide-react";
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
		? { label: "Converted", icon: CheckCircle2, tone: "border-success/25 bg-success/10 text-success" }
		: hasDismissedDeprecatedLegacyState && hasLegacyData
			? { label: "Not restored", icon: Clock3, tone: "border-highlight/15 bg-highlight/5 text-muted-foreground" }
			: isOutstanding
				? { label: "Outstanding", icon: Clock3, tone: "border-warning/25 bg-warning/10 text-warning" }
				: { label: "No old data", icon: CheckCircle2, tone: "border-highlight/10 bg-highlight/5 text-subtle-foreground" };
	const StatusIcon = status.icon;

	return (
		<div className="space-y-3 p-4 sm:p-5">
			<div className="flex flex-wrap items-center gap-2">
				<div className="text-sm font-medium text-foreground">Old profile data</div>
				<span
					className={cn(
						"inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px]",
						status.tone,
					)}
				>
					<StatusIcon size={13} />
					{status.label}
				</span>
			</div>
			<div className="max-w-md text-xs leading-5 text-muted-foreground">
				Review and copy data saved before separate PVP, PVE, and KORD profiles were introduced.
			</div>

			<button
				type="button"
				disabled={!hasLegacyData}
				onClick={() => openDialog(true)}
				className="inline-flex items-center rounded-md border border-foreground/30 bg-foreground/10 px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-foreground/20 disabled:cursor-not-allowed disabled:opacity-40 sm:text-sm"
			>
				{hasConvertedDeprecatedLegacyState ? "Open conversion dialog again" : "Open conversion dialog"}
			</button>
		</div>
	);
}

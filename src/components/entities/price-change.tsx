import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** The provider reports this change over 48 hours, not 24 hours. */
export function PriceChange({ value, compact = false }: { value: number; compact?: boolean }) {
	if (!Number.isFinite(value)) return null;
	const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : ArrowRight;
	const direction = value > 0 ? "Up" : value < 0 ? "Down" : "Unchanged";
	return (
		<span
			title={`${direction} ${Math.abs(value).toFixed(2)}% over 48 hours`}
			aria-label={`${direction} ${Math.abs(value).toFixed(2)}% over 48 hours`}
			className={cn(
				"inline-flex shrink-0 items-center gap-0.5 rounded font-mono",
				compact ? "text-[11px]" : "gap-1 rounded-md px-2 py-1 text-xs",
				value > 0 ? "text-success" : value < 0 ? "text-danger" : "text-muted-foreground",
				!compact && (value > 0 ? "bg-success/10" : value < 0 ? "bg-danger/10" : "bg-highlight/5"),
			)}
		>
			<Icon size={compact ? 11 : 13} aria-hidden="true" />
			{Math.abs(value).toFixed(2)}%
		</span>
	);
}

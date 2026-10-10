import { cn } from "@/lib/utils";

export function Stat({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
	return (
		<div className="min-w-0 rounded-md bg-surface-raised/40 px-3 py-2">
			<div className={cn("text-xl font-semibold tabular-nums leading-tight", accent && "text-brand")}>{value}</div>
			<div className="text-[11px] text-muted-foreground">{label}</div>
		</div>
	);
}

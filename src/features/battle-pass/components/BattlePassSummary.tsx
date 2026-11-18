import { Clock3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { DocumentIcon } from "./ui/DocumentIcon";

const deadlineFormat = new Intl.DateTimeFormat("en-US", {
	timeZone: "America/Los_Angeles",
	month: "short",
	day: "numeric",
	year: "numeric",
	hour: "numeric",
	minute: "2-digit",
	timeZoneName: "short",
});

export function BattlePassSummary({
	endsAt,
	goalTotal,
	remainingTotal,
}: {
	endsAt: number | null;
	goalTotal: number | null;
	remainingTotal: number;
}) {
	const columns = [
		...(goalTotal === null ? [] : [{ label: "Goals", total: goalTotal }]),
		{ label: "Everything", total: remainingTotal },
	];
	return (
		<div className="grid gap-1.5">
			<div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-surface-raised/40 px-4 py-2.5 text-xs text-muted-foreground">
				<Clock3 size={14} aria-hidden />
				<span>Season ends</span>
				{endsAt === null ? (
					<span className="ml-auto">To be announced</span>
				) : (
					<time dateTime={new Date(endsAt).toISOString()} className="ml-auto font-medium text-foreground">
						{deadlineFormat.format(endsAt)}
					</time>
				)}
			</div>
			<div className={cn("grid gap-1.5", columns.length === 2 && "grid-cols-2")} aria-live="polite">
				{columns.map(({ label, total }) => (
					<div key={label} className="grid min-w-0 gap-1.5">
						<div className="rounded-lg bg-surface-raised/40 px-4 py-3">
							<p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
							<p className="mt-1 flex items-baseline gap-1.5">
								<span className="text-3xl font-semibold tracking-tight tabular-nums">
									{total.toLocaleString("en-US")}
								</span>
								<span className="flex items-center gap-1 text-xs text-muted-foreground">
									<DocumentIcon className="size-3" />
									docs
								</span>
							</p>
						</div>
						<div
							className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1 rounded-lg px-4 py-2"
							style={{
								color: "var(--classified)",
								backgroundColor: "color-mix(in oklab, var(--classified) 10%, transparent)",
							}}
							title="Alternative cost using only classified documents at 1:1. Includes prerequisites; owned inventory is not deducted."
						>
							<span className="text-lg font-semibold tabular-nums">{total.toLocaleString("en-US")}</span>
							<span className="flex items-center gap-1 text-[11px]">
								<DocumentIcon documentKey="classified" className="size-3" />
								Classified only
							</span>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

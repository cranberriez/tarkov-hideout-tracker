import { Bookmark, Clock3, HandCoins, LoaderCircle } from "lucide-react";
import type { ItemAction } from "./decision-model";
import { cn } from "@/lib/utils";

export const decisionAppearance = {
	KEEP: {
		Icon: Bookmark,
		label: "Keep",
		overlay: "bg-success/20 hover:bg-success/30",
		ink: "text-success",
		chip: "bg-success/15 text-success",
	},
	SELL: {
		Icon: HandCoins,
		label: "Sell",
		overlay: "bg-acquisition-sell-value/20 hover:bg-acquisition-sell-value/30",
		ink: "text-acquisition-sell-value",
		chip: "bg-acquisition-sell-value/15 text-acquisition-sell-value",
	},
	HOLD: {
		Icon: Clock3,
		label: "Hold",
		overlay: "bg-info/20 hover:bg-info/30",
		ink: "text-info",
		chip: "bg-info/15 text-info",
	},
};

export function DecisionMarker({ action, pending = false }: { action?: ItemAction; pending?: boolean }) {
	const Icon = pending || !action ? LoaderCircle : decisionAppearance[action].Icon;
	return (
		<span
			title={pending || !action ? "Loading decision" : decisionAppearance[action].label}
			className={cn(
				"inline-flex rounded-sm bg-card/95 p-0.5 shadow-sm",
				action ? decisionAppearance[action].ink : "text-muted-foreground",
			)}
		>
			<Icon
				size={14}
				strokeWidth={2.25}
				aria-hidden="true"
				className={pending || !action ? "animate-spin motion-reduce:animate-none" : ""}
			/>
		</span>
	);
}

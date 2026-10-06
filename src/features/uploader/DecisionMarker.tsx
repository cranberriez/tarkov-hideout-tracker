import { Bookmark, Clock3, HandCoins, LoaderCircle, Trophy } from "lucide-react";
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

/** Kept copies reserved for Kappa still count as Keep but read as Kappa. */
export const kappaAppearance = {
	Icon: Trophy,
	label: "Kappa",
	overlay: "bg-special/20 hover:bg-special/30",
	ink: "text-special",
	chip: "bg-special/15 text-special",
};

export const appearanceFor = (action: ItemAction, kappa = false) =>
	kappa ? kappaAppearance : decisionAppearance[action];

export function DecisionMarker({
	action,
	pending = false,
	kappa = false,
}: {
	action?: ItemAction;
	pending?: boolean;
	kappa?: boolean;
}) {
	const look = action && appearanceFor(action, kappa);
	const Icon = pending || !look ? LoaderCircle : look.Icon;
	return (
		<span
			title={pending || !look ? "Loading decision" : look.label}
			className={cn("inline-flex rounded-sm bg-card/95 p-0.5 shadow-sm", look ? look.ink : "text-muted-foreground")}
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

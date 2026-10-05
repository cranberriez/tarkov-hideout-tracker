import { Bookmark, Clock3, HandCoins, LoaderCircle } from "lucide-react";
import type { ItemAction } from "./decision-model";
import { cn } from "@/lib/utils";

export const decisionAppearance = {
	KEEP: { Icon: Bookmark, overlay: "bg-success/20 hover:bg-success/30", ink: "text-success" },
	HOLD: { Icon: Clock3, overlay: "bg-warning/15 hover:bg-warning/25", ink: "text-warning" },
	SELL: { Icon: HandCoins, overlay: "bg-brand/20 hover:bg-brand/30", ink: "text-brand" },
};

export function DecisionMarker({ action, pending = false }: { action: ItemAction; pending?: boolean }) {
	const Icon = pending ? LoaderCircle : decisionAppearance[action].Icon;
	return (
		<span
			title={pending ? "Loading decision" : action}
			className={cn("inline-flex rounded-sm bg-card/95 p-0.5 shadow-sm", decisionAppearance[action].ink)}
		>
			<Icon
				size={14}
				strokeWidth={2.25}
				aria-hidden="true"
				className={pending ? "animate-spin motion-reduce:animate-none" : ""}
			/>
		</span>
	);
}

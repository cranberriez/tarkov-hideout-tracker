"use client";

import { CircleDot } from "lucide-react";
import { isLoyaltyTrader, orderTraders, TraderLoyaltyControl } from "@/components/entities/trader-loyalty";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Trader } from "@/types/traders";

/** Edits the active profile's trader loyalty levels, shared with the quest trader filter. */
export function TraderLevelsModal({
	open,
	onOpenChange,
	traders,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	traders: Trader[];
}) {
	const editableTraders = orderTraders(traders.filter(isLoyaltyTrader));
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto p-0">
				<DialogHeader className="border-b border-border-color px-4 py-3.5 pr-11">
					<DialogTitle>Trader levels</DialogTitle>
					<DialogDescription className="text-xs">
						Loyalty levels unlock trader offers and barters for this profile.
					</DialogDescription>
				</DialogHeader>
				<ul className="pb-2">
					{editableTraders.map((trader) => {
						const traderImage = trader.image4xLink ?? trader.imageLink;
						return (
							<li
								key={trader.id}
								className="flex items-center gap-3 border-b border-highlight/8 px-4 py-2 last:border-b-0"
							>
								{traderImage ? (
									// eslint-disable-next-line @next/next/no-img-element -- remote trader art is not optimized
									<img src={traderImage} alt="" className="h-8 w-8 rounded-full object-cover grayscale-[20%]" />
								) : (
									<span className="flex h-8 w-8 items-center justify-center rounded-full bg-highlight/5 text-subtle-foreground">
										<CircleDot size={14} />
									</span>
								)}
								<span className="min-w-0 flex-1 truncate text-sm text-foreground">{trader.name}</span>
								<TraderLoyaltyControl trader={trader} />
							</li>
						);
					})}
				</ul>
			</DialogContent>
		</Dialog>
	);
}

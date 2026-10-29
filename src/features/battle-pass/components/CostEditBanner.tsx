"use client";
import { useState } from "react";
import { Pencil, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shown while editing costs: why types can differ, how to edit, and a confirmed reset. */
export function CostEditBanner({
	editedCount,
	resetAll,
	close,
}: {
	editedCount: number;
	resetAll: () => void;
	close: () => void;
}) {
	const [confirming, setConfirming] = useState(false);
	return (
		<section
			aria-label="Editing document costs"
			className="flex flex-wrap items-start gap-x-6 gap-y-3 rounded-xl bg-brand/10 p-4 text-sm"
		>
			<div className="min-w-0 flex-1 basis-96 space-y-1">
				<h2 className="flex items-center gap-2 font-semibold text-brand">
					<Pencil size={14} aria-hidden />
					Editing document costs
				</h2>
				<p className="text-muted-foreground">
					Document types vary per player; totals don&apos;t. Click a document on a reward to swap it for the type your
					game shows.
				</p>
			</div>
			<div className="ml-auto flex items-center gap-2">
				<span className="text-xs tabular-nums text-muted-foreground">
					{editedCount} {editedCount === 1 ? "reward" : "rewards"} edited
				</span>
				{confirming && (
					<Button size="xs" variant="ghost" onClick={() => setConfirming(false)}>
						Cancel
					</Button>
				)}
				<Button
					size="xs"
					variant="ghost"
					tone="danger"
					disabled={editedCount === 0}
					onClick={() => {
						if (!confirming) return setConfirming(true);
						resetAll();
						setConfirming(false);
					}}
				>
					<RotateCcw size={12} aria-hidden />
					{confirming ? `Reset ${editedCount} ${editedCount === 1 ? "reward" : "rewards"}?` : "Reset all"}
				</Button>
				<Button size="xs" tone="brand" variant="soft" onClick={close}>
					Done
				</Button>
			</div>
		</section>
	);
}

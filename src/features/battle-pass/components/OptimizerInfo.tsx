"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

const STEPS = [
	{
		title: "Enter costs and documents",
		body: "Set each reward's document cost and the documents you own in each mode. The optimizer only uses what you enter.",
	},
	{
		title: "Pick a destination",
		body: "Choose a reward, your saved goals or finishing the season. It finds the cheapest set of rewards that gets you there.",
	},
	{
		title: "Assign profiles and order",
		body: "It decides which profile (PVP, PVE or seasonal) claims each reward and in what order, using documents you own first, then your classified documents.",
	},
	{
		title: "Choose how much to gather",
		body: "The gathering target lists each point where farming more documents lowers what you pay. Pick what you can farm before the season ends.",
	},
	{
		title: "Fund the rest",
		body: "It picks the cheapest TarCoin and classified packs to cover what is still missing, counting TarCoins that rewards pay out along the way.",
	},
	{
		title: "Follow the plan",
		body: "The Plan lists every step in order: gather, buy TarCoins, buy classified, claim. Save it to follow over time.",
	},
	{
		title: "Keep it up to date",
		body: "Update your documents as you gather them. If a cheaper or shorter route appears, a banner offers to review it.",
	},
];

/** Small info button that explains, step by step, how the route optimizer works. */
export function OptimizerInfo() {
	const [open, setOpen] = useState(false);
	return (
		<>
			<Button
				variant="ghost"
				size="sm"
				iconOnly
				title="How the optimizer works"
				aria-label="How the optimizer works"
				className="text-muted-foreground"
				onClick={() => setOpen(true)}
			>
				<Info className="size-4" aria-hidden />
			</Button>
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="grid max-h-[85vh] max-w-lg gap-4 overflow-y-auto p-5 pr-12 sm:p-6 sm:pr-12">
					<div className="space-y-1">
						<DialogTitle className="text-base font-semibold">How the optimizer works</DialogTitle>
						<DialogDescription className="text-xs text-muted-foreground">
							It plans the cheapest way to reach your destination with what you own.
						</DialogDescription>
					</div>
					<ol className="space-y-3">
						{STEPS.map((step, index) => (
							<li key={step.title} className="flex gap-3">
								<span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-raised text-xs font-semibold tabular-nums text-brand">
									{index + 1}
								</span>
								<div className="min-w-0 space-y-0.5">
									<p className="text-sm font-semibold">{step.title}</p>
									<p className="text-xs text-muted-foreground">{step.body}</p>
								</div>
							</li>
						))}
					</ol>
				</DialogContent>
			</Dialog>
		</>
	);
}

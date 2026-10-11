/// <reference types="react/canary" />
import { ViewTransition } from "react";
import { LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pages, toggleId, type PassPage, type Costs } from "../lib/battle-pass-model";
import { tileSpans } from "../lib/battle-pass-display";
import type { useBattlePass } from "../useBattlePass";
import { RewardCard } from "./RewardCard";
import styles from "../battle-pass.module.css";

export function RewardPage({
	page,
	complete,
	goals,
	filler,
	openPages,
	cumulative,
	cumulativeCosts,
	update,
	inventory,
	completeTiles,
	toggleTile,
	possibleFractions,
	possibleAllocations,
}: {
	page: PassPage;
	complete: Set<string>;
	goals: Set<string>;
	filler: Set<string>;
	openPages: boolean[];
	cumulative: boolean;
	cumulativeCosts: Map<string, Costs>;
	update: ReturnType<typeof useBattlePass>[1];
	inventory: Costs;
	completeTiles: (ids: string[]) => void;
	toggleTile: (id: string) => void;
	possibleFractions: Map<string, number>;
	possibleAllocations?: Map<string, Costs>;
}) {
	const index = pages.indexOf(page);
	const doneCount = page.cells.filter((tile) => complete.has(tile.id)).length;
	const suggestedIds = page.cells
		.filter((tile) => filler.has(tile.id) && !complete.has(tile.id))
		.map((tile) => tile.id);
	const previousDone = index > 0 ? pages[index - 1].cells.filter((tile) => complete.has(tile.id)).length : 0;
	return (
		<ViewTransition
			key={page.num}
			enter={{ "page-next": styles.slideInRight, "page-prev": styles.slideInLeft, default: "none" }}
			exit={{ "page-next": styles.slideOutLeft, "page-prev": styles.slideOutRight, default: "none" }}
		>
			<section aria-labelledby={`pass-page-${page.num}`} className="min-w-0 rounded-xl bg-card/50 p-3 sm:p-4">
				<header className="mb-3 flex flex-wrap items-center justify-between gap-2">
					<div className="flex min-w-0 items-center gap-3">
						<h2 id={`pass-page-${page.num}`} className="shrink-0 text-sm font-semibold">
							Page {String(page.num).padStart(2, "0")}
						</h2>
						{!openPages[index] && (
							<span
								title={`Claim ${page.req} rewards on page ${page.num - 1} and unlock earlier pages.`}
								className="flex items-center gap-1 text-[11px] text-subtle-foreground"
							>
								<LockKeyhole size={12} />
								{previousDone}/{page.req} on page {page.num - 1}
							</span>
						)}
					</div>
					<div className="ml-auto flex items-center gap-1">
						<Button
							size="xs"
							variant="ghost"
							disabled={suggestedIds.length === 0}
							aria-label={`Complete suggested: Page ${page.num}`}
							onClick={() => completeTiles(suggestedIds)}
						>
							Complete suggested
						</Button>
						<Button
							size="xs"
							variant="ghost"
							disabled={doneCount === page.cells.length}
							aria-label={`Complete all: Page ${page.num}`}
							onClick={() => completeTiles(page.cells.map((tile) => tile.id))}
						>
							Complete all
						</Button>
					</div>
				</header>
				<div className={styles.rewardGrid}>
					{page.cells.map((tile) => (
						<RewardCard
							key={tile.id}
							tile={tile}
							span={tileSpans[tile.id]}
							pageNumber={page.num}
							done={complete.has(tile.id)}
							goal={goals.has(tile.id)}
							filler={filler.has(tile.id)}
							costs={cumulative ? (cumulativeCosts.get(tile.id) ?? {}) : tile.cost}
							inventory={possibleAllocations ? (possibleAllocations.get(tile.id) ?? {}) : inventory}
							possibleFraction={possibleFractions.get(tile.id) ?? 0}
							previewEnabled={possibleAllocations !== undefined}
							toggleGoal={() => update((current) => ({ ...current, goals: toggleId(current.goals, tile.id) }))}
							toggleDone={() => toggleTile(tile.id)}
						/>
					))}
				</div>
			</section>
		</ViewTransition>
	);
}

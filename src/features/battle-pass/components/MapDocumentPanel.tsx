"use client";
import { useBattlePassData } from "../BattlePassSeason";
import { useMemo, type Ref } from "react";
import { coverCosts, planGoals } from "../lib/battle-pass-model";
import { useBattlePass } from "../useBattlePass";
import { DocumentInventory } from "./DocumentInventory";
import styles from "../battle-pass-map.module.css";

export function MapDocumentPanel({ ref }: { ref: Ref<HTMLElement> }) {
	const { pages, tiles, documentKeys } = useBattlePassData();
	const [progress, update] = useBattlePass();
	const scope = progress.goals.length === 0 ? "all" : "goals";
	const plan = useMemo(
		() =>
			planGoals(
				scope === "all" ? tiles.map((tile) => tile.id) : progress.goals,
				progress.completed,
				pages,
				progress.avoidedDocuments,
			),
		[scope, progress.goals, progress.completed, progress.avoidedDocuments, pages, tiles],
	);
	const coverage = useMemo(
		() =>
			coverCosts(plan.costs, progress.inventory, progress.classified, false, progress.avoidedDocuments, documentKeys),
		[plan.costs, progress.inventory, progress.classified, progress.avoidedDocuments, documentKeys],
	);
	return (
		<aside
			ref={ref}
			id="map-documents"
			aria-labelledby="map-documents-heading"
			tabIndex={-1}
			className={styles.documentPanel}
		>
			<h2 id="map-documents-heading" className="text-sm font-semibold">
				Documents
			</h2>
			<p className="mt-1 text-xs text-muted-foreground">
				Documents still needed for {scope === "all" ? "all remaining rewards" : "your reward goals"}.
			</p>
			<DocumentInventory progress={progress} update={update} coverage={coverage} />
			<div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-xs text-muted-foreground">
				<span>Total for {scope}</span>
				<span className="text-sm font-semibold tabular-nums text-foreground">{plan.total}</span>
			</div>
		</aside>
	);
}

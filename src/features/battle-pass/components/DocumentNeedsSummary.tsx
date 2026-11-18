"use client";

import type { ReactNode } from "react";
import { FileText } from "lucide-react";
import { useBattlePassData } from "../BattlePassSeason";
import type { useDocumentInventory } from "../useDocumentInventory";
import { coverCosts, type Costs } from "../lib/battle-pass-model";
import { documentDisplayName } from "../lib/battle-pass-display";
import { DocumentIcon } from "./ui/DocumentIcon";
import { cn } from "@/lib/utils";

/** Optimizer-free view: the selected inventory against the plan scope's configured costs. */
export function DocumentNeedsSummary({
	inventory,
	costs,
	scopeLabel,
}: {
	inventory: ReturnType<typeof useDocumentInventory>;
	costs: Costs | null;
	scopeLabel: string;
}) {
	const { documents, documentKeys } = useBattlePassData();
	const { selectedProfile, progress, preferences } = inventory;
	const coverage = costs
		? coverCosts(
				costs,
				selectedProfile.inventory,
				progress.classified,
				preferences.useClassified,
				progress.avoidedDocuments,
				documentKeys,
			)
		: null;
	const needed = coverage?.rows.reduce((n, row) => n + row.required, 0) ?? 0;
	const covered = coverage ? coverage.ownedUsed + coverage.classifiedUsed : 0;
	const percent = needed ? Math.round((100 * covered) / needed) : 0;
	return (
		<div className="space-y-3">
			<div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1 text-sm">
				<p className="text-muted-foreground">
					{selectedProfile.label} inventory for {scopeLabel}
				</p>
				{coverage && (
					<p>
						<strong className="tabular-nums">{covered.toLocaleString()}</strong>
						<span className="text-muted-foreground"> / {needed.toLocaleString()} covered</span>
						{coverage.missing > 0 && (
							<strong className="ml-3 text-warning tabular-nums">{coverage.missing} missing</strong>
						)}
					</p>
				)}
			</div>
			{coverage ? (
				<div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-highlight/10">
					<div className="h-full rounded-full bg-brand" style={{ width: `${percent}%` }} />
				</div>
			) : (
				<p role="status" className="rounded-lg bg-warning/10 px-4 py-3 text-sm text-warning">
					Configure costs to see what you need.
				</p>
			)}
			<ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9">
				{documents.map((doc) => {
					const row = coverage?.rows.find((entry) => entry.key === doc.key);
					const owned = selectedProfile.inventory[doc.key] ?? 0;
					return (
						<NeedTile
							key={doc.key}
							icon={<DocumentIcon documentKey={doc.key} className="size-6 shrink-0" />}
							name={doc.key === "blueprints" ? "BP & Tech" : documentDisplayName(doc.name)}
							owned={owned}
							required={row?.required}
							missing={row?.missing}
						/>
					);
				})}
				<NeedTile
					classified
					icon={<FileText className="size-6 shrink-0 text-classified" aria-hidden />}
					name="Classified"
					owned={progress.classified}
					required={coverage && preferences.useClassified ? coverage.classifiedUsed : undefined}
					missing={coverage?.classifiedMissing}
				/>
			</ul>
		</div>
	);
}

function NeedTile({
	icon,
	name,
	owned,
	required,
	missing,
	classified = false,
}: {
	icon: ReactNode;
	name: string;
	owned: number;
	required?: number;
	missing?: number;
	classified?: boolean;
}) {
	const percent = required ? Math.min(100, Math.round((100 * Math.min(owned, required)) / required)) : 0;
	return (
		<li
			className={cn(
				"flex min-h-28 flex-col gap-3 rounded-lg p-3",
				classified ? "bg-classified/10" : "bg-surface-raised/40",
			)}
		>
			<span className="flex items-center gap-2 text-xs font-medium">
				{icon}
				{name}
			</span>
			<span className="mt-auto space-y-1.5">
				<span className="flex items-baseline justify-between gap-2">
					<span className="text-xl leading-none font-semibold tabular-nums">
						{owned}
						{required !== undefined && <span className="text-sm font-normal text-muted-foreground"> / {required}</span>}
					</span>
					{missing !== undefined &&
						(missing > 0 ? (
							<span className="text-xs font-semibold text-warning tabular-nums">−{missing}</span>
						) : (
							required !== undefined &&
							required > 0 && <span className="text-xs font-semibold text-success">Covered</span>
						))}
				</span>
				{required !== undefined && required > 0 && (
					<span aria-hidden className="block h-1 overflow-hidden rounded-full bg-highlight/10">
						<span
							className={cn("block h-full rounded-full", classified ? "bg-classified" : "bg-brand")}
							style={{ width: `${percent}%` }}
						/>
					</span>
				)}
			</span>
		</li>
	);
}

"use client";

import { useId } from "react";
import { Ban, Check, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBattlePassData } from "../BattlePassSeason";
import type { useDocumentInventory } from "../useDocumentInventory";
import { coverCosts, type Costs } from "../lib/battle-pass-model";
import { CLASSIFIED_DOCUMENT, documentDisplayName } from "../lib/battle-pass-display";
import { DocumentChip } from "./ui/DocumentChip";
import { Toggle } from "./ui/Toggle";
import { cn } from "@/lib/utils";
import styles from "../battle-pass.module.css";

function DocumentMark({ documentKey, corner = false }: { documentKey: string; corner?: boolean }) {
	const { documentMarks } = useBattlePassData();
	const mark = documentMarks[documentKey];
	return mark ? (
		<span
			aria-hidden
			className={styles.mark}
			data-shape={mark.shape}
			style={{ position: corner ? "absolute" : "static", flexShrink: 0, backgroundColor: mark.color }}
		/>
	) : null;
}

function DocumentName({ documentKey, name }: { documentKey: string; name: string }) {
	return (
		<h3 className="flex min-h-6 items-center justify-center gap-1 text-center text-xs leading-tight font-medium">
			<DocumentMark documentKey={documentKey} />
			{name}
		</h3>
	);
}

export function DocumentInventoryPanel({
	inventory,
	costs,
}: {
	inventory: ReturnType<typeof useDocumentInventory>;
	costs: Costs | null;
}) {
	const { documents, documentKeys } = useBattlePassData();
	const { profiles, selectedProfile, selectProfile, available, progress, preferences, setPreference } = inventory;
	const { viewAll, availableProfiles } = inventory;
	const expanded = preferences.documentInventoryExpanded;
	const panelId = useId();
	const coverage = costs
		? coverCosts(
				costs,
				viewAll ? inventory.combinedInventory : selectedProfile.inventory,
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
		<section aria-label="Document inventory" className={cn("rounded-lg bg-card p-3 sm:p-4", expanded && "space-y-4")}>
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex items-center gap-3">
					<Button
						iconOnly
						size="sm"
						aria-label={expanded ? "Collapse document inventory" : "Expand document inventory"}
						aria-expanded={expanded}
						aria-controls={panelId}
						onClick={() => setPreference("documentInventoryExpanded", !expanded)}
					>
						{expanded ? (
							<ChevronDown className="size-4" aria-hidden />
						) : (
							<ChevronRight className="size-4" aria-hidden />
						)}
					</Button>
					<h2 className="text-sm font-semibold">Document inventory</h2>
					{coverage && needed > 0 && (
						<p
							className="text-sm"
							aria-label={`${covered} of ${needed} documents covered, ${coverage.missing} missing`}
						>
							<strong className="tabular-nums">{covered.toLocaleString()}</strong>
							<span className="text-muted-foreground"> / {needed.toLocaleString()} covered</span>
							{coverage.missing > 0 && (
								<strong className="ml-3 text-warning tabular-nums">{coverage.missing} missing</strong>
							)}
						</p>
					)}
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<Toggle
						className={preferences.useClassified ? "bg-classified/15 text-classified" : undefined}
						checked={preferences.useClassified}
						onChange={(value) => setPreference("useClassified", value)}
						title="Use shared classified documents once across the plan after ordinary inventory."
					>
						Use classified
					</Toggle>
					<div role="group" aria-label="Document inventory profile" className="inline-flex shrink-0">
						{[...profiles, { key: "all", label: "All", color: "var(--brand)" }].map((profile) => {
							const selected = profile.key === "all" ? viewAll : !viewAll && selectedProfile.key === profile.key;
							return (
								<Button
									key={profile.key}
									size="sm"
									variant="ghost"
									className="rounded-none border-0 px-3 first:rounded-l-md last:rounded-r-md"
									style={{
										backgroundColor: `color-mix(in srgb, ${profile.color} ${selected ? "22%" : "8%"}, transparent)`,
										color: selected ? "var(--foreground)" : undefined,
										boxShadow: selected ? `inset 0 0 0 1px ${profile.color}` : undefined,
									}}
									title={profile.key === "all" ? "Combined inventory across every active profile" : undefined}
									aria-pressed={selected}
									onClick={() => selectProfile(profile.key)}
								>
									{profile.label}
								</Button>
							);
						})}
					</div>
				</div>
			</div>
			{coverage && needed > 0 && (
				<div aria-hidden className={cn("h-1.5 overflow-hidden rounded-full bg-highlight/10", !expanded && "mt-3")}>
					<div className="h-full rounded-full bg-brand" style={{ width: `${percent}%` }} />
				</div>
			)}
			{!available && !viewAll && (
				<p role="status" className="text-sm text-warning">
					Activate this seasonal character in Setup to edit its inventory.
				</p>
			)}
			{/* TODO: Redesign the collapsed document inventory summary before restoring it.
			{!expanded && (
				<ul aria-label="Document inventory totals" className="flex flex-wrap gap-2">
					{[...documents, { key: "classified", name: "Classified Docs" }].map((doc) => {
						const count = doc.key === "classified" ? progress.classified : (selectedProfile.inventory[doc.key] ?? 0);
						return (
							<li
								key={doc.key}
								aria-label={`${documentDisplayName(doc.name)}: ${count} owned`}
								className={cn(
									"flex items-center gap-2 rounded-md px-1.5 py-1",
									doc.key === "classified" ? "bg-classified/10" : "bg-surface-raised/40",
								)}
							>
								<div className="relative size-10 shrink-0">
									<DocumentChip doc={doc} inventory />
									<DocumentMark documentKey={doc.key} corner />
								</div>
								<span className="min-w-4 text-sm font-medium tabular-nums">{count}</span>
							</li>
						);
					})}
				</ul>
			)}
			*/}
			<div id={panelId} hidden={!expanded}>
				<div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9">
					{documents.map((doc) => {
						const label = documentDisplayName(doc.name);
						const avoided = progress.avoidedDocuments.includes(doc.key);
						const row = coverage?.rows.find((entry) => entry.key === doc.key);
						return (
							<div key={doc.key} className="flex min-w-0 flex-col gap-2 rounded-md bg-surface-raised/40 p-3">
								<DocumentName documentKey={doc.key} name={doc.key === "blueprints" ? "BP & Tech" : label} />
								<div className="mx-auto w-[88%]">
									<DocumentChip doc={doc} inventory />
								</div>
								{viewAll ? (
									<div className="flex flex-col gap-1 text-xs text-muted-foreground">
										Owned
										{profiles.map((profile) => {
											const active = availableProfiles.some((entry) => entry.key === profile.key);
											return (
												<label key={profile.key} className="flex items-center gap-2">
													<span
														className="w-9 shrink-0 truncate font-medium"
														style={{ color: profile.color }}
														title={profile.label}
													>
														{profile.label}
													</span>
													<input
														type="number"
														min={0}
														max={99999}
														step={1}
														inputMode="numeric"
														disabled={!active}
														aria-label={`${profile.label} ${label} owned`}
														value={profile.inventory[doc.key] ?? 0}
														onChange={(event) =>
															inventory.setOwnedFor(profile.key, doc.key, Number(event.target.value))
														}
														className="h-7 w-full min-w-0 rounded border border-border bg-surface-raised text-center text-sm text-foreground tabular-nums outline-brand disabled:opacity-40"
													/>
												</label>
											);
										})}
									</div>
								) : (
									<label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
										Owned
										<input
											type="number"
											min={0}
											max={99999}
											step={1}
											inputMode="numeric"
											disabled={!available}
											aria-label={`${selectedProfile.label} ${label} owned`}
											value={selectedProfile.inventory[doc.key] ?? 0}
											onChange={(event) => inventory.setOwned(doc.key, Number(event.target.value))}
											className="h-9 w-full rounded border border-border bg-surface-raised text-center text-sm text-foreground tabular-nums outline-brand disabled:opacity-40"
										/>
									</label>
								)}
								{row && row.required > 0 && (
									<NeedMeter label={label} owned={row.used} required={row.required} missing={row.missing} />
								)}
								<Button
									size="xs"
									variant="ghost"
									aria-pressed={!avoided}
									aria-label={`${avoided ? "Enable" : "Disable"} collecting ${label}`}
									onClick={() => inventory.toggleCollect(doc.key)}
									className={cn(
										"mt-auto border-0 px-1",
										avoided
											? "bg-classified/10 text-classified hover:bg-classified/20"
											: "bg-brand/10 text-brand hover:bg-brand/20",
									)}
								>
									{avoided ? <Ban size={13} aria-hidden /> : <Check size={13} aria-hidden />}
									{avoided ? "Use classified" : "Collect"}
								</Button>
							</div>
						);
					})}
					<div className="flex min-w-0 flex-col gap-2 rounded-md bg-classified/10 p-3">
						<DocumentName documentKey="classified" name="Classified Docs" />
						<div className="mx-auto w-[88%]">
							<DocumentChip doc={CLASSIFIED_DOCUMENT} inventory />
						</div>
						<label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
							Owned
							<input
								type="number"
								min={0}
								max={99999}
								step={1}
								inputMode="numeric"
								aria-label="Classified Docs owned"
								value={progress.classified}
								onChange={(event) => inventory.setClassified(Number(event.target.value))}
								className="h-9 w-full rounded border border-border bg-surface-raised text-center text-sm text-foreground tabular-nums outline-brand"
							/>
						</label>
						{coverage && coverage.classifiedUsed + coverage.classifiedMissing > 0 && (
							<NeedMeter
								classified
								label="Classified Docs"
								owned={coverage.classifiedUsed}
								required={coverage.classifiedUsed + coverage.classifiedMissing}
								missing={coverage.classifiedMissing}
							/>
						)}
					</div>
				</div>
			</div>
		</section>
	);
}

/** Need against the plan scope: requirement, shortfall, and a thin coverage bar. */
function NeedMeter({
	label,
	owned,
	required,
	missing,
	classified = false,
}: {
	label: string;
	owned: number;
	required: number;
	missing: number;
	classified?: boolean;
}) {
	return (
		<div className="space-y-1 text-xs" aria-label={`${label}: ${owned} of ${required} needed covered`}>
			<p className="flex items-baseline justify-between gap-2">
				<span className="text-muted-foreground">
					Need <strong className="text-foreground tabular-nums">{required}</strong>
				</span>
				{missing > 0 ? (
					<strong className="text-warning tabular-nums">−{missing}</strong>
				) : (
					<strong className="text-success">Covered</strong>
				)}
			</p>
			<div aria-hidden className="h-1 overflow-hidden rounded-full bg-highlight/10">
				<div
					className={cn("h-full rounded-full", classified ? "bg-classified" : "bg-brand")}
					style={{ width: `${Math.min(100, Math.round((100 * owned) / required))}%` }}
				/>
			</div>
		</div>
	);
}

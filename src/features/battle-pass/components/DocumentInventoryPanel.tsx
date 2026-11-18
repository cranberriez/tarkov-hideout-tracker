"use client";

import { useId } from "react";
import { Ban, Check, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBattlePassData } from "../BattlePassSeason";
import type { useDocumentInventory } from "../useDocumentInventory";
import { coverCosts, type Costs } from "../lib/battle-pass-model";
import { documentDisplayName } from "../lib/battle-pass-display";
import { DocumentChip } from "./ui/DocumentChip";
import { Toggle } from "./ui/Toggle";
import { ConsumeDocumentsToggle } from "./ConsumeDocumentsToggle";
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
	const expanded = preferences.documentInventoryExpanded;
	const panelId = useId();
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
	return (
		<section aria-label="Document inventory" className="space-y-4 rounded-lg bg-card p-3 sm:p-4">
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
					<ConsumeDocumentsToggle
						checked={preferences.consumeDocs}
						onChange={(value) => setPreference("consumeDocs", value)}
					/>
					<div role="group" aria-label="Document inventory profile" className="inline-flex shrink-0">
						{profiles.map((profile) => (
							<Button
								key={profile.key}
								size="sm"
								variant="ghost"
								className="rounded-none border-0 px-3 first:rounded-l-md last:rounded-r-md"
								style={{
									backgroundColor: `color-mix(in srgb, ${profile.color} ${selectedProfile.key === profile.key ? "22%" : "8%"}, transparent)`,
									color: selectedProfile.key === profile.key ? "var(--foreground)" : undefined,
									boxShadow: selectedProfile.key === profile.key ? `inset 0 0 0 1px ${profile.color}` : undefined,
								}}
								aria-pressed={selectedProfile.key === profile.key}
								onClick={() => selectProfile(profile.key)}
							>
								{profile.label}
							</Button>
						))}
					</div>
				</div>
			</div>
			{!available && (
				<p role="status" className="text-sm text-warning">
					Activate this seasonal character in Setup to edit its inventory.
				</p>
			)}
			{expanded && preferences.consumeDocs && (
				<p className="text-xs text-muted-foreground">
					Claims deduct available documents from {selectedProfile.label} and, with Use classified enabled, the shared
					classified balance. All rewards in a claim need configured costs. Unclaiming does not refund documents.
				</p>
			)}
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
								{row && row.missing > 0 && (
									<p className="text-xs text-muted-foreground" aria-label={`${label} still needed`}>
										Need <strong className="text-foreground tabular-nums">{row.missing}</strong>
									</p>
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
						<div className="mx-auto flex aspect-square w-[88%] items-center justify-center">
							<DocumentChip doc={{ key: "classified", name: "Classified Docs" }} />
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
						{coverage && coverage.classifiedMissing > 0 && (
							<p className="text-xs text-muted-foreground" aria-label="Classified Docs still needed">
								Need <strong className="text-foreground tabular-nums">{coverage.classifiedMissing}</strong>
							</p>
						)}
					</div>
				</div>
			</div>
			{inventory.notice && (
				<p role="status" className="text-sm text-warning">
					{inventory.notice}
				</p>
			)}
		</section>
	);
}

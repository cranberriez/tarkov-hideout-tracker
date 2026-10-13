"use client";
import { useBattlePassData } from "../BattlePassSeason";
import { getSeason } from "@/lib/cfg/seasons";
import type { CSSProperties, ReactNode } from "react";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProfileDocuments } from "../useProfileDocuments";
import { type Tile, type planGoals, type coverCosts } from "../lib/battle-pass-model";
import { Stat } from "./ui/Stat";
import { DocumentChip } from "./ui/DocumentChip";

export function BattlePassOverview({
	scope,
	knownGoals,
	completedCount,
	possibleCount,
	remainingTotal,
	plan,
	coverage,
	selected,
	filler,
	headerAction,
	allProfiles,
	setAllProfiles,
	profileDocuments,
	children,
}: {
	scope: "all" | "goals";
	knownGoals: Tile[];
	completedCount: number;
	possibleCount: number;
	remainingTotal: number;
	plan: ReturnType<typeof planGoals>;
	coverage: ReturnType<typeof coverCosts>;
	selected: Set<string>;
	filler: Set<string>;
	headerAction: ReactNode;
	/** When set, `coverage` already counts ordinary stock from every profile. */
	allProfiles: boolean;
	setAllProfiles: (checked: boolean) => void;
	profileDocuments: ProfileDocuments;
	children: ReactNode;
}) {
	const { pages, tiles, documents, seasonId } = useBattlePassData();
	const collect = [
		...coverage.rows
			.filter((row) => row.missing > 0)
			.map((row) => ({ doc: documents.find((doc) => doc.key === row.key)!, amount: row.missing })),
		...(coverage.classifiedMissing > 0
			? [
					{
						doc: { key: "classified", name: "Classified Docs · wildcard 1:1" },
						amount: coverage.classifiedMissing,
					},
				]
			: []),
	];
	return (
		<section aria-label="Battle pass overview" className="space-y-3 rounded-xl bg-card p-4">
			<div className="flex items-start justify-between gap-3">
				<div>
					<p className="mb-1 text-[11px] font-medium uppercase tracking-[0.18em] text-brand">
						{getSeason(seasonId).title}
					</p>
					<h1 className="text-2xl font-semibold tracking-tight">Battle Pass</h1>
				</div>
				{headerAction}
			</div>
			<div className="flex items-center gap-3">
				<div
					className="flex h-1.5 flex-1 overflow-hidden rounded bg-surface-raised"
					role="progressbar"
					aria-label="Battle pass completion"
					aria-valuenow={completedCount}
					aria-valuemin={0}
					aria-valuemax={tiles.length}
					aria-valuetext={`${completedCount} claimed${possibleCount > 0 ? `, ${possibleCount.toFixed(1)} additional reward equivalents possible with owned documents` : ""}`}
				>
					<div
						className="h-full bg-success transition-[width]"
						style={{ width: `${(completedCount / tiles.length) * 100}%` }}
					/>
					<div
						className="h-full bg-warning transition-[width]"
						style={{ width: `${(possibleCount / tiles.length) * 100}%` }}
					/>
				</div>
				<p className="shrink-0 text-xs text-muted-foreground">
					<span className="font-semibold text-foreground">{completedCount}</span> / {tiles.length} claimed ·{" "}
					{remainingTotal} docs left
				</p>
			</div>
			{children}
			{plan.unresolvedIds.length > 0 && (
				<p role="alert" className="text-xs text-warning">
					{plan.unresolvedIds.length} saved goals unavailable; excluded from totals.
				</p>
			)}
			{plan.selected.length === 0 ? (
				<p className="text-sm text-subtle-foreground">
					{knownGoals.length > 0 || scope === "all" ? "All done." : "Flag a reward to plan your route."}
				</p>
			) : (
				<>
					<div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-live="polite">
						<Stat label="Plan" value={plan.total} />
						<Stat label="Owned" value={coverage.ownedUsed} />
						<Stat label="Classified" value={coverage.classifiedUsed} />
						<Stat label="To collect" value={coverage.missing} accent />
					</div>
					<div className="space-y-2">
						<div className="flex items-center justify-between gap-3">
							<h2 className="text-xs text-muted-foreground">Documents to collect{allProfiles && " · all profiles"}</h2>
							<Button
								variant="ghost"
								size="xs"
								selected={allProfiles}
								aria-pressed={allProfiles}
								onClick={() => setAllProfiles(!allProfiles)}
								title="Count ordinary documents owned by every profile. Classified documents are shared."
							>
								<Users size={13} aria-hidden />
								All profiles
							</Button>
						</div>
						{collect.length > 0 ? (
							<div className="overflow-x-auto p-1">
								<div
									role="table"
									aria-label="Documents to collect"
									className="grid items-center gap-x-3 gap-y-1.5"
									style={
										{
											gridTemplateColumns: `${allProfiles ? "auto " : ""}repeat(${collect.length}, minmax(92px, 1fr))`,
										} as CSSProperties
									}
								>
									<div role="row" className="contents">
										{allProfiles && <span role="columnheader" aria-hidden />}
										{collect.map(({ doc, amount }) => (
											<div key={doc.key} role="columnheader" className="min-w-0">
												<DocumentChip doc={doc} amount={amount} large />
											</div>
										))}
									</div>
									{allProfiles &&
										profileDocuments.profiles.map((profile) => (
											<div key={profile.key} role="row" className="contents">
												<span role="rowheader" className="pr-1 text-xs font-semibold" style={{ color: profile.color }}>
													{profile.label}
												</span>
												{collect.map(({ doc }) => (
													<span
														key={doc.key}
														role="cell"
														className="text-center text-sm tabular-nums text-muted-foreground"
													>
														{doc.key === "classified" ? "—" : (profile.inventory[doc.key] ?? 0)}
													</span>
												))}
											</div>
										))}
								</div>
							</div>
						) : (
							<p className="text-xs text-success">All plan documents covered.</p>
						)}
					</div>
					<details>
						<summary className="w-fit cursor-pointer text-xs text-muted-foreground">
							Breakdown · {plan.selected.length} rewards
							{plan.fillerIds.length > 0 ? ` · ${plan.fillerIds.length} suggested` : ""}
						</summary>
						<div className="mt-4 grid gap-6 xl:grid-cols-2">
							<div className="overflow-x-auto">
								<table className="w-full text-right text-xs">
									<caption className="sr-only">Plan document requirements</caption>
									<thead className="text-subtle-foreground">
										<tr>
											<th className="text-left font-normal">Document</th>
											<th className="font-normal">Need</th>
											{allProfiles ? (
												profileDocuments.profiles.map((profile) => (
													<th key={profile.key} className="font-normal" style={{ color: profile.color }}>
														{profile.label}
													</th>
												))
											) : (
												<th className="font-normal">Owned</th>
											)}
											<th className="font-normal">Classified</th>
											<th className="font-normal">Missing</th>
										</tr>
									</thead>
									<tbody>
										{coverage.rows.map((row) => (
											<tr key={row.key}>
												<th className="py-1 text-left font-normal">
													<DocumentChip doc={documents.find((doc) => doc.key === row.key)!} />
												</th>
												<td>{row.required}</td>
												{allProfiles ? (
													profileDocuments.profiles.map((profile) => (
														<td key={profile.key}>{profile.inventory[row.key] ?? 0}</td>
													))
												) : (
													<td>{row.used}</td>
												)}
												<td className="text-special">
													{row.classified || "—"}
													{row.classifiedMissing > 0 && " (+" + row.classifiedMissing + " needed)"}
												</td>
												<td className={row.missing ? "text-warning" : "text-success"}>{row.missing}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
							<div className="grid content-start gap-3 sm:grid-cols-2">
								{pages
									.filter((page) => page.cells.some((tile) => selected.has(tile.id)))
									.map((page) => (
										<div key={page.num}>
											<h3 className="mb-2 text-xs font-semibold text-muted-foreground">Page {page.num}</h3>
											<ul className="space-y-1">
												{page.cells
													.filter((tile) => selected.has(tile.id))
													.map((tile) => (
														<li key={tile.id} className="flex gap-2 text-xs">
															<span className="min-w-0 flex-1 truncate" title={tile.displayName}>
																{tile.displayName}
															</span>
															{filler.has(tile.id) && <span className="text-info">Suggested</span>}
															<span className="tabular-nums text-subtle-foreground">{tile.totalDocumentCost}</span>
														</li>
													))}
											</ul>
										</div>
									))}
							</div>
						</div>
					</details>
				</>
			)}
		</section>
	);
}

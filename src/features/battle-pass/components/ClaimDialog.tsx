"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { CircleAlert, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useBattlePassData } from "../BattlePassSeason";
import { CLASSIFIED_DOCUMENT, documentDisplayName } from "../lib/battle-pass-display";
import type { Costs } from "../lib/battle-pass-model";
import { applyClaims, rowClassified, type ClaimRow } from "../lib/claim-deduction-model";
import type { ClaimPreview } from "../useBattlePassPlan";
import type { ClaimWriteResult } from "../useDocumentInventory";
import { Artwork } from "./ui/Artwork";

const usd = (cents: number) => `$${(Math.abs(cents) / 100).toFixed(2)}`;

/** Confirms claims under a saved plan: the documents each claim should consume, editable when the player's differ. */
export function ClaimDialog({
	rows,
	onClose,
	preview,
	confirm,
	classifiedBalance,
	setClassified,
	inventories,
}: {
	/** Rewards to claim, or null when closed. */
	rows: ClaimRow[] | null;
	onClose: () => void;
	preview: (rows: (ClaimRow & { have: Costs })[]) => ClaimPreview | null;
	confirm: (rows: (ClaimRow & { have: Costs })[]) => ClaimWriteResult;
	classifiedBalance: number;
	setClassified: (value: number) => void;
	inventories: Record<string, Costs>;
}) {
	return (
		<Dialog open={!!rows} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="max-h-[calc(100dvh-2rem)] max-w-xl gap-0 overflow-y-auto p-0">
				{rows && (
					<ClaimForm
						key={rows.map((row) => row.rewardId).join()}
						{...{ rows, onClose, preview, confirm, classifiedBalance, setClassified, inventories }}
					/>
				)}
			</DialogContent>
		</Dialog>
	);
}

function ClaimForm({
	rows,
	onClose,
	preview,
	confirm,
	classifiedBalance,
	setClassified,
	inventories,
}: {
	rows: ClaimRow[];
	onClose: () => void;
	preview: (rows: (ClaimRow & { have: Costs })[]) => ClaimPreview | null;
	confirm: (rows: (ClaimRow & { have: Costs })[]) => ClaimWriteResult;
	classifiedBalance: number;
	setClassified: (value: number) => void;
	inventories: Record<string, Costs>;
}) {
	const { tiles } = useBattlePassData();
	const [editing, setEditing] = useState(false);
	const [haves, setHaves] = useState<Record<string, Costs>>(() =>
		Object.fromEntries(rows.map((row) => [row.rewardId, { ...row.expected }])),
	);
	const [failure, setFailure] = useState<Extract<ClaimWriteResult, { ok: false }> | null>(null);
	const entered = useMemo(
		() => rows.map((row) => ({ ...row, have: haves[row.rewardId] ?? row.expected })),
		[rows, haves],
	);
	const changed = entered.some((row) =>
		Object.keys(row.cost ?? {}).some((key) => (row.have[key] ?? 0) !== (row.expected[key] ?? 0)),
	);
	const offPlan = rows.some((row) => row.planIndex === null);
	const effect = useMemo(() => (changed || offPlan ? preview(entered) : null), [changed, offPlan, preview, entered]);
	const outcome = applyClaims(entered, inventories, classifiedBalance);
	// Classified the plan itself expects to buy before these claims, as opposed to shortfalls from edits.
	const plannedShort = applyClaims(
		rows.map((row) => ({ ...row, have: row.expected })),
		inventories,
		classifiedBalance,
	).classifiedShort;
	const classifiedNeeded = entered.reduce((sum, row) => sum + rowClassified(row, row.have), 0);
	const single = rows.length === 1;
	const nameOf = (id: string) => tiles.find((tile) => tile.id === id)?.displayName ?? id;
	const setHave = (rewardId: string, key: string, value: number) =>
		setHaves((current) => ({ ...current, [rewardId]: { ...current[rewardId], [key]: value } }));

	const submit = () => {
		const result = confirm(entered);
		if (result.ok) onClose();
		else setFailure(result);
	};

	const resetToPlan = () => setHaves(Object.fromEntries(rows.map((row) => [row.rewardId, { ...row.expected }])));
	const meta = (row: ClaimRow) =>
		`${row.profileLabel} · ${row.planIndex ? `Claim #${row.planIndex}` : "Not in your plan"}`;

	return (
		<>
			<div className="px-5 pt-4 pr-12 pb-3">
				<DialogTitle className="text-base font-semibold">
					{single ? `Claim ${nameOf(rows[0].rewardId)}` : `Claim ${rows.length} rewards`}
				</DialogTitle>
				<DialogDescription className="text-xs text-muted-foreground">
					{single ? meta(rows[0]) : "In claim order"}
				</DialogDescription>
			</div>
			<div className="space-y-4 px-5 pb-4">
				<div className="space-y-3">
					<p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
						{editing ? "What you have" : "You should have"}
					</p>
					{entered.map((row) => {
						const classified = rowClassified(row, row.have);
						return (
							<section key={row.rewardId} aria-label={nameOf(row.rewardId)} className="space-y-2">
								{!single && (
									<header className="flex flex-wrap items-baseline gap-x-2 text-sm">
										<span className="font-medium">{nameOf(row.rewardId)}</span>
										<span className="text-xs text-muted-foreground">{meta(row)}</span>
									</header>
								)}
								{row.cost ? (
									<ul className="flex flex-wrap gap-2">
										{Object.entries(row.cost).map(([key, amount]) => (
											<DocumentTile
												key={key}
												documentKey={key}
												have={row.have[key] ?? 0}
												amount={amount}
												editing={editing}
												onChange={(value) => setHave(row.rewardId, key, value)}
											/>
										))}
										{classified > 0 && <ClassifiedTile count={classified} />}
									</ul>
								) : (
									<p className="text-sm text-warning">No configured cost. It is recorded without removing documents.</p>
								)}
							</section>
						);
					})}
					<button
						type="button"
						aria-pressed={editing}
						onClick={() => {
							// Going back to the plan restores its amounts.
							if (editing) resetToPlan();
							setEditing(!editing);
						}}
						className="cursor-pointer text-xs text-brand underline-offset-2 hover:underline"
					>
						{editing ? "Use the planned amounts" : "My amounts are different"}
					</button>
				</div>

				{classifiedNeeded > 0 && (
					<div className="space-y-2 rounded-md bg-classified/10 px-3 py-2.5 text-sm">
						<div className="flex flex-wrap items-center justify-between gap-2">
							<span>
								Needs <strong className="text-classified tabular-nums">{classifiedNeeded}</strong> classified
							</span>
							<label className="flex items-center gap-2 text-muted-foreground">
								You have
								<input
									type="number"
									min={0}
									inputMode="numeric"
									aria-label="Classified documents you have"
									value={classifiedBalance}
									onChange={(event) => setClassified(Number(event.target.value) || 0)}
									className="w-16 rounded-md border border-border-color bg-surface-raised px-2 py-0.5 text-foreground tabular-nums"
								/>
							</label>
						</div>
						{outcome.classifiedShort === 0 ? (
							<p className="text-xs text-muted-foreground">Covered by your classified documents.</p>
						) : (
							<>
								{plannedShort > 0 && (
									<p className="text-xs text-warning">
										Your plan buys {Math.min(plannedShort, outcome.classifiedShort)} classified before this
										{single ? " claim" : " point"}. Buy them in-game, then enter how many you have.
									</p>
								)}
								{outcome.classifiedShort > plannedShort && (
									<p className="text-xs text-warning">
										{outcome.classifiedShort - plannedShort} more because you have fewer documents than planned. Gather
										the rest first, or buy more classified.
									</p>
								)}
							</>
						)}
					</div>
				)}
				{effect && <EffectLine effect={effect} changed={changed} />}
				{failure && (
					<p role="alert" className="flex items-start gap-2 rounded-md bg-danger/10 p-3 text-sm text-danger">
						<CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
						{failure.message}{" "}
						{failure.undone
							? "Nothing was changed."
							: "Some changes could not be undone. Check your document inventory and claimed rewards."}
					</p>
				)}
			</div>
			<div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border-color px-5 py-3">
				<p className="min-w-0 flex-1 text-xs text-muted-foreground">
					Claiming removes these documents from your inventory.
				</p>
				<div className="ml-auto flex gap-2">
					<Button variant="soft" size="sm" onClick={onClose}>
						Cancel
					</Button>
					<Button variant="solid" size="sm" disabled={outcome.classifiedShort > 0} onClick={submit}>
						Claim
					</Button>
				</div>
			</div>
		</>
	);
}

function EffectLine({ effect, changed }: { effect: ClaimPreview; changed: boolean }) {
	const parts: string[] = [];
	if (effect.extraDocuments > 0)
		parts.push(`The rest of your plan needs ${effect.extraDocuments} more documents, gathered later where possible.`);
	else if (effect.extraDocuments < 0)
		parts.push(`The rest of your plan needs ${-effect.extraDocuments} fewer documents.`);
	if (effect.cashDeltaCents > 0) parts.push(`Your checkout rises by ${usd(effect.cashDeltaCents)}.`);
	else if (effect.cashDeltaCents < 0) parts.push(`Your checkout drops by ${usd(effect.cashDeltaCents)}.`);
	const intro =
		effect.offPlan > 0
			? `${effect.offPlan === 1 ? "This reward isn't" : `${effect.offPlan} rewards aren't`} in your saved plan. `
			: "";
	return (
		<p
			role="status"
			className={cn(
				"rounded-md p-3 text-sm",
				effect.cashDeltaCents > 0 ? "bg-warning/10 text-warning" : "bg-surface-raised/60 text-muted-foreground",
			)}
		>
			{intro}
			{parts.length ? parts.join(" ") : changed || effect.offPlan ? "Your plan is unchanged." : null}
		</p>
	);
}

function DocumentTile({
	documentKey,
	have,
	amount,
	editing,
	onChange,
}: {
	documentKey: string;
	have: number;
	amount: number;
	editing: boolean;
	onChange: (value: number) => void;
}) {
	const { documents, documentMarks } = useBattlePassData();
	const doc = documents.find((entry) => entry.key === documentKey);
	const name = documentDisplayName(doc?.name ?? documentKey);
	const mark = documentMarks[documentKey];
	return (
		<li className="flex w-20 flex-col items-center gap-1">
			<span
				className="relative block size-20 overflow-hidden rounded-md bg-surface-raised/60"
				style={{ "--doc-color": mark?.color } as CSSProperties}
				title={name}
			>
				{doc?.img && <Artwork src={doc.img} sizes="160px" className="h-full w-full !object-cover" />}
				<span
					className={cn(
						"absolute right-1 bottom-0.5 text-sm font-semibold tabular-nums [text-shadow:0_1px_2px_rgb(0_0_0/0.9)]",
						have >= amount ? "text-success" : "text-foreground",
					)}
				>
					{have}/{amount}
				</span>
			</span>
			<span className="w-full truncate text-center text-[11px] text-muted-foreground">{name}</span>
			{editing && (
				<span className="flex items-center gap-1">
					<Button
						variant="ghost"
						size="xs"
						aria-label={`Fewer ${name}`}
						disabled={have <= 0}
						onClick={() => onChange(have - 1)}
					>
						<Minus size={12} aria-hidden />
					</Button>
					<span className="min-w-4 text-center text-sm tabular-nums">{have}</span>
					<Button
						variant="ghost"
						size="xs"
						aria-label={`More ${name}`}
						disabled={have >= amount}
						onClick={() => onChange(have + 1)}
					>
						<Plus size={12} aria-hidden />
					</Button>
				</span>
			)}
		</li>
	);
}

function ClassifiedTile({ count }: { count: number }) {
	return (
		<li className="flex w-20 flex-col items-center gap-1">
			<span className="relative block size-20 overflow-hidden rounded-md bg-classified/10" title="Classified documents">
				<Artwork src={CLASSIFIED_DOCUMENT.img} sizes="160px" className="h-full w-full scale-150 !object-contain" />
				<span className="absolute right-1 bottom-0.5 text-sm font-semibold tabular-nums text-classified [text-shadow:0_1px_2px_rgb(0_0_0/0.9)]">
					{count}
				</span>
			</span>
			<span className="w-full truncate text-center text-[11px] text-classified">Classified</span>
		</li>
	);
}

"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
	ArrowRight,
	ChevronRight,
	CircleAlert,
	CircleCheck,
	FileJson,
	SquareArrowDown,
	SquareArrowUp,
	TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useStoredProfitValue } from "@/features/profit-pages/useStoredProfitValue";
import { SEASONS } from "@/lib/cfg/seasons";
import { cn } from "@/lib/utils";
import { useBattlePassData } from "../BattlePassSeason";
import type { useDocumentInventory } from "../useDocumentInventory";
import { BATTLE_PASS_PREFERENCES_KEY } from "../lib/battle-pass-preferences";
import { FUNDING_SETTINGS_KEY } from "../lib/funding-settings-model";
import { savedRouteKey } from "../lib/saved-route-model";
import {
	buildExport,
	exportFileName,
	importWrites,
	reviewImport,
	type TransferContext,
	type TransferSection,
	type TransferSources,
	type TransferStore,
} from "../lib/battle-pass-transfer-model";

type View = "export" | "import";
type Inventory = ReturnType<typeof useDocumentInventory>;

const seasonName = (id: string) => SEASONS.find((season) => season.id === id)?.name ?? id;

/** Every battle-pass save, read and written through the same synchronized storage hook as the page. */
function useTransferStores(inventory: Inventory) {
	const data = useBattlePassData();
	const [progress, writeProgress] = useStoredProfitValue(data.storageKey);
	const [costs, writeCosts] = useStoredProfitValue(`tarkov-battle-pass-costs-${data.seasonId}-v1`);
	const [route, writeRoute] = useStoredProfitValue(savedRouteKey(data.seasonId));
	const [funding, writeFunding] = useStoredProfitValue(FUNDING_SETTINGS_KEY);
	const [preferences, writePreferences] = useStoredProfitValue(BATTLE_PASS_PREFERENCES_KEY);
	const sources: TransferSources = useMemo(
		() => ({ progress, costs, route, funding, preferences }),
		[progress, costs, route, funding, preferences],
	);
	const writers: Record<TransferStore, typeof writeProgress> = {
		progress: writeProgress,
		costs: writeCosts,
		route: writeRoute,
		funding: writeFunding,
		preferences: writePreferences,
	};
	const context: TransferContext = useMemo(
		() => ({
			seasonId: data.seasonId,
			seasonName,
			tiles: data.tiles,
			documents: data.documents,
			profiles: inventory.availableProfiles,
		}),
		[data, inventory.availableProfiles],
	);
	return { sources, writers, context };
}

/** Compact utility row with battle-pass-only export and import. */
export function BattlePassTransfer({ inventory }: { inventory: Inventory }) {
	const [view, setView] = useState<View | null>(null);
	const stores = useTransferStores(inventory);
	return (
		<>
			<div className="flex items-center justify-end gap-1 pt-2" aria-label="Battle pass utilities" role="toolbar">
				<Button variant="ghost" size="sm" iconOnly title="Export battle pass" onClick={() => setView("export")}>
					<SquareArrowUp size={16} aria-hidden />
					<span className="sr-only">Export battle pass</span>
				</Button>
				<Button variant="ghost" size="sm" iconOnly title="Import battle pass" onClick={() => setView("import")}>
					<SquareArrowDown size={16} aria-hidden />
					<span className="sr-only">Import battle pass</span>
				</Button>
			</div>
			<Dialog open={view !== null} onOpenChange={(open) => !open && setView(null)}>
				<DialogContent className="max-w-lg gap-0 p-0">
					<div className="flex items-center gap-3 px-5 pt-4 pr-12 pb-3">
						<div className="min-w-0 flex-1">
							<DialogTitle className="text-base font-semibold">
								{view === "import" ? "Import battle pass" : "Export battle pass"}
							</DialogTitle>
							<DialogDescription className="text-xs text-muted-foreground">
								{seasonName(stores.context.seasonId)} only. Smaller than a full account backup.
							</DialogDescription>
						</div>
						<div className="flex gap-1">
							<Button
								variant="ghost"
								size="xs"
								iconOnly
								selected={view === "export"}
								aria-pressed={view === "export"}
								title="Export"
								onClick={() => setView("export")}
							>
								<SquareArrowUp size={15} aria-hidden />
								<span className="sr-only">Export</span>
							</Button>
							<Button
								variant="ghost"
								size="xs"
								iconOnly
								selected={view === "import"}
								aria-pressed={view === "import"}
								title="Import"
								onClick={() => setView("import")}
							>
								<SquareArrowDown size={15} aria-hidden />
								<span className="sr-only">Import</span>
							</Button>
						</div>
					</div>
					<div className="max-h-[70vh] overflow-y-auto px-5 pb-5">
						{view === "import" ? (
							<ImportView {...stores} inventory={inventory} onClose={() => setView(null)} />
						) : (
							<ExportView {...stores} />
						)}
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}

function ExportView({ sources, context }: { sources: TransferSources; context: TransferContext }) {
	const preview = useMemo(() => buildExport(sources, context), [sources, context]);
	const customCosts = Object.keys(preview.costs.rewards).length;
	const lines = [
		["Documents", context.profiles.map((profile) => profile.label).join(", ") || "No accounts"],
		["Completed rewards", String(preview.progress.completed.length)],
		["Goals", String(preview.progress.goals.length)],
		["Classified documents", String(preview.progress.classified)],
		[
			"Document costs",
			`${preview.costs.useDefaults ? "Defaults" : "Custom"}${customCosts ? ` · ${customCosts} configured` : ""}`,
		],
		["Saved plan", preview.route.locked ? `${preview.route.locked.claims.length} claims` : "None"],
		["Funding & gathering", "Included"],
		["Page toggles", "Plan scope, classified, optimizer, recommendations"],
	];
	const download = () => {
		const now = new Date();
		const file = buildExport(sources, context, now);
		const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: "application/json" }));
		const link = document.createElement("a");
		link.href = url;
		link.download = exportFileName(context.seasonId, now);
		link.click();
		URL.revokeObjectURL(url);
	};
	return (
		<div className="space-y-4">
			<dl className="divide-y divide-border-color/60 rounded-lg bg-surface-raised/30 text-sm">
				{lines.map(([label, value]) => (
					<div key={label} className="flex items-baseline justify-between gap-4 px-3 py-1.5">
						<dt className="text-muted-foreground">{label}</dt>
						<dd className="text-right tabular-nums">{value}</dd>
					</div>
				))}
			</dl>
			<div className="flex justify-end">
				<Button variant="solid" tone="brand" size="sm" onClick={download}>
					<SquareArrowUp size={14} aria-hidden />
					Download JSON
				</Button>
			</div>
		</div>
	);
}

function ImportView({
	sources,
	writers,
	context,
	inventory,
	onClose,
}: ReturnType<typeof useTransferStores> & { inventory: Inventory; onClose: () => void }) {
	const [file, setFile] = useState<{ name: string; text: string } | null>(null);
	const [readError, setReadError] = useState("");
	const [dragging, setDragging] = useState(false);
	const [skipped, setSkipped] = useState<Set<string>>(new Set());
	const [imported, setImported] = useState<number | null>(null);
	const input = useRef<HTMLInputElement>(null);
	// Re-reviewed against the latest saves, so another tab's edit never hides a change.
	const review = useMemo(() => (file ? reviewImport(file.text, sources, context) : null), [file, sources, context]);

	const load = async (picked: File | undefined) => {
		setDragging(false);
		if (!picked) return;
		try {
			const text = await picked.text();
			setReadError("");
			setSkipped(new Set());
			setImported(null);
			setFile({ name: picked.name, text });
		} catch {
			setReadError("Could not read that file.");
		}
	};
	const reset = () => {
		setFile(null);
		setReadError("");
		setImported(null);
		if (input.current) input.current.value = "";
	};

	if (imported !== null)
		return (
			<div className="flex flex-col items-center gap-3 py-8 text-center">
				<CircleCheck size={28} className="text-success" aria-hidden />
				<p className="text-sm" role="status">
					Imported {imported} {imported === 1 ? "change" : "changes"}.
				</p>
				<div className="flex gap-2">
					<Button variant="soft" size="sm" onClick={reset}>
						Import another
					</Button>
					<Button variant="solid" tone="brand" size="sm" onClick={onClose}>
						Done
					</Button>
				</div>
			</div>
		);

	if (!file || !review)
		return (
			<div
				onDragEnter={(event) => {
					event.preventDefault();
					setDragging(true);
				}}
				onDragOver={(event) => event.preventDefault()}
				onDragLeave={(event: DragEvent) => {
					if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
				}}
				onDrop={(event) => {
					event.preventDefault();
					void load(event.dataTransfer.files[0]);
				}}
				className={cn(
					"flex min-h-44 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors",
					dragging ? "border-brand bg-accent text-brand" : "border-highlight/20 text-muted-foreground",
				)}
			>
				<input
					ref={input}
					type="file"
					accept=".json,application/json"
					className="sr-only"
					tabIndex={-1}
					onChange={(event) => void load(event.target.files?.[0])}
				/>
				{dragging ? (
					<p className="pointer-events-none text-sm font-semibold">Drop it</p>
				) : (
					<>
						<Button variant="soft" size="sm" onClick={() => input.current?.click()}>
							<FileJson size={14} aria-hidden />
							Choose file
						</Button>
						<p className="text-xs">or drop a battle pass export here</p>
					</>
				)}
				{readError && (
					<p role="alert" className="text-xs text-danger">
						{readError}
					</p>
				)}
			</div>
		);

	if (!review.ok)
		return (
			<div className="space-y-4">
				<FileLine name={file.name} />
				<ul role="alert" className="space-y-1 rounded-lg bg-danger-surface p-3 text-sm text-danger">
					{review.errors.map((error) => (
						<li key={error} className="flex items-start gap-2">
							<CircleAlert size={15} className="mt-0.5 shrink-0" aria-hidden />
							{error}
						</li>
					))}
				</ul>
				<div className="flex justify-end">
					<Button variant="soft" size="sm" onClick={reset}>
						Choose another file
					</Button>
				</div>
			</div>
		);

	const rows = review.sections.flatMap((section) => section.rows);
	const chosen = rows.filter((row) => !skipped.has(row.id));
	const setRows = (ids: string[], include: boolean) =>
		setSkipped((current) => {
			const next = new Set(current);
			for (const id of ids) {
				if (include) next.delete(id);
				else next.add(id);
			}
			return next;
		});
	const apply = () => {
		const { writes, documents } = importWrites(chosen.map((row) => row.change));
		for (const [store, transform] of writes) writers[store](transform);
		for (const change of documents) inventory.setOwnedFor(change.profile, change.key, change.value);
		setImported(chosen.length);
	};
	return (
		<div className="space-y-3">
			<FileLine
				name={file.name}
				detail={review.exportedAt ? `Exported ${new Date(review.exportedAt).toLocaleString()}` : undefined}
			/>
			{review.warnings.length > 0 && (
				<ul className="space-y-1 rounded-lg bg-warning-surface p-3 text-xs text-warning">
					{review.warnings.map((warning) => (
						<li key={warning} className="flex items-start gap-2">
							<TriangleAlert size={14} className="mt-px shrink-0" aria-hidden />
							{warning}
						</li>
					))}
				</ul>
			)}
			<p className="text-xs text-muted-foreground">
				{rows.length
					? "Checked values overwrite what's saved here. Expand a section to choose individual values."
					: "Everything in this file already matches what's saved here."}
			</p>
			<div className="divide-y divide-border-color/60 rounded-lg bg-surface-raised/30">
				{review.sections.map((section) => (
					<SectionReview key={section.id} section={section} skipped={skipped} setRows={setRows} />
				))}
			</div>
			<div className="flex justify-end gap-2 pt-1">
				<Button variant="soft" size="sm" onClick={reset}>
					Choose another file
				</Button>
				<Button variant="solid" tone="brand" size="sm" disabled={!chosen.length} onClick={apply}>
					<SquareArrowDown size={14} aria-hidden />
					Overwrite {chosen.length} {chosen.length === 1 ? "value" : "values"}
				</Button>
			</div>
		</div>
	);
}

function FileLine({ name, detail }: { name: string; detail?: string }) {
	return (
		<p className="flex items-center gap-2 text-sm">
			<FileJson size={15} className="shrink-0 text-muted-foreground" aria-hidden />
			<span className="min-w-0 truncate font-medium">{name}</span>
			{detail && <span className="ml-auto shrink-0 text-xs text-muted-foreground">{detail}</span>}
		</p>
	);
}

function Check({
	checked,
	indeterminate = false,
	label,
	onChange,
}: {
	checked: boolean;
	indeterminate?: boolean;
	label: string;
	onChange: (checked: boolean) => void;
}) {
	const ref = useRef<HTMLInputElement>(null);
	useEffect(() => {
		if (ref.current) ref.current.indeterminate = indeterminate;
	}, [indeterminate]);
	return (
		<input
			ref={ref}
			type="checkbox"
			aria-label={label}
			className="size-4 shrink-0 cursor-pointer accent-brand"
			checked={checked}
			onChange={(event) => onChange(event.target.checked)}
		/>
	);
}

function SectionReview({
	section,
	skipped,
	setRows,
}: {
	section: TransferSection;
	skipped: Set<string>;
	setRows: (ids: string[], include: boolean) => void;
}) {
	const [open, setOpen] = useState(false);
	const ids = section.rows.map((row) => row.id);
	const included = ids.filter((id) => !skipped.has(id)).length;
	const empty = ids.length === 0;
	// A short single value reads fully in its header; expanding would only repeat it.
	const only = section.rows.length === 1 ? section.rows[0] : null;
	const single = only && `${only.label}${only.current}${only.incoming}`.length <= 44 ? only : null;
	return (
		<div className={cn(empty && "opacity-60")}>
			<div className="flex items-center gap-2 px-3 py-2">
				{empty ? (
					<span className="size-4 shrink-0" aria-hidden />
				) : (
					<Check
						label={`Overwrite ${section.title}`}
						checked={included === ids.length}
						indeterminate={included > 0 && included < ids.length}
						onChange={(value) => setRows(ids, value)}
					/>
				)}
				<button
					type="button"
					disabled={empty || !!single}
					aria-expanded={empty || single ? undefined : open}
					onClick={() => setOpen((value) => !value)}
					className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-sm disabled:cursor-default"
				>
					{!empty && !single && (
						<ChevronRight
							size={14}
							className={cn("shrink-0 text-muted-foreground transition-transform", open && "rotate-90")}
							aria-hidden
						/>
					)}
					<span className="font-medium">{section.title}</span>
					<span className="ml-auto truncate pl-2 text-xs text-muted-foreground">
						{empty ? (
							"No changes"
						) : single ? (
							<>
								{single.label} · <Change row={single} />
							</>
						) : (
							`${included} / ${ids.length} ${ids.length === 1 ? "change" : "changes"}`
						)}
					</span>
				</button>
			</div>
			{open && !single && (
				<ul className="space-y-0.5 px-3 pb-2 pl-9">
					{section.rows.map((row) => (
						<li key={row.id} className="flex items-start gap-2 py-0.5 text-xs">
							<Check
								label={`Overwrite ${row.label}`}
								checked={!skipped.has(row.id)}
								onChange={(value) => setRows([row.id], value)}
							/>
							<span className="max-w-[45%] shrink-0">{row.label}</span>
							<span className="ml-auto min-w-0 text-right text-muted-foreground">
								<Change row={row} />
							</span>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

function Change({ row }: { row: { label: string; current: string; incoming: string } }) {
	return (
		<span className="tabular-nums" title={`${row.label}: ${row.current} → ${row.incoming}`}>
			{row.current}
			<ArrowRight size={11} className="mx-1 inline align-[-1px]" aria-hidden />
			<span className="text-foreground">{row.incoming}</span>
		</span>
	);
}

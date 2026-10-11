import { Ban, Check } from "lucide-react";
import { documents, normalizeCount, toggleId, type coverCosts } from "../lib/battle-pass-model";
import { documentDisplayName, documentMarks } from "../lib/battle-pass-display";
import type { useBattlePass } from "../useBattlePass";
import { DocumentChip } from "./ui/DocumentChip";
import { ActionChip } from "./ui/ActionChip";
import { cn } from "@/lib/utils";

export function DocumentInventory({
	progress,
	update,
	coverage,
}: {
	progress: ReturnType<typeof useBattlePass>[0];
	update: ReturnType<typeof useBattlePass>[1];
	coverage: ReturnType<typeof coverCosts>;
}) {
	return (
		<div className="mt-3 grid grid-cols-[40px_1fr_64px_36px] items-center gap-x-2 gap-y-1">
			<span aria-hidden />
			<span className="text-right text-[11px] text-muted-foreground">Need</span>
			<span className="text-center text-[11px] text-muted-foreground">Owned</span>
			<span aria-hidden />
			{documents.map((doc) => {
				const displayName = documentDisplayName(doc.name);
				const row = coverage.rows.find((row) => row.key === doc.key)!;
				const avoided = progress.avoidedDocuments.includes(doc.key);
				return (
					<div key={doc.key} className="contents">
						<DocumentChip doc={doc} end />
						<span
							aria-label={displayName + " still needed"}
							className={cn(
								"text-right text-sm tabular-nums",
								row.missing > 0 ? "text-brand" : "text-muted-foreground",
							)}
						>
							{row.missing}
						</span>
						<input
							type="number"
							min={0}
							max={99999}
							step={1}
							inputMode="numeric"
							aria-label={displayName + " owned"}
							className="h-9 w-full min-w-0 rounded bg-surface-raised text-center text-sm tabular-nums outline-brand"
							value={progress.inventory[doc.key] ?? 0}
							onChange={(event) =>
								update((current) => ({
									...current,
									inventory: { ...current.inventory, [doc.key]: normalizeCount(Number(event.target.value)) },
								}))
							}
						/>
						<ActionChip
							active={!avoided}
							tone={avoided ? "avoid" : "done"}
							label={avoided ? "Use classified" : "Collect"}
							accessibleLabel={(avoided ? "Enable" : "Disable") + " collecting " + displayName}
							icon={avoided ? <Ban size={17} /> : <Check size={17} />}
							onClick={() =>
								update((current) => ({
									...current,
									avoidedDocuments: toggleId(current.avoidedDocuments, doc.key),
								}))
							}
						/>
					</div>
				);
			})}
			<div className="contents">
				<DocumentChip doc={{ key: "classified", name: "Classified Docs · wildcard 1:1" }} end />
				<span
					aria-label="Classified Docs still needed"
					className="text-right text-sm tabular-nums"
					style={{ color: documentMarks.classified.color }}
				>
					{coverage.classifiedMissing}
				</span>
				<input
					type="number"
					min={0}
					max={99999}
					step={1}
					inputMode="numeric"
					aria-label="Classified Docs owned"
					className="h-9 w-full min-w-0 rounded bg-special/10 text-center text-sm tabular-nums outline-brand"
					value={progress.classified}
					onChange={(event) =>
						update((current) => ({ ...current, classified: normalizeCount(Number(event.target.value)) }))
					}
				/>
				<span aria-hidden />
			</div>
		</div>
	);
}

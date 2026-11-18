import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBattlePassData } from "../BattlePassSeason";
import { documentDisplayName } from "../lib/battle-pass-display";
import type { CostEntry } from "../lib/battle-pass-configuration";
import type { Tile } from "../lib/battle-pass-model";
import { DocumentIcon } from "./ui/DocumentIcon";

function CostSlot({
	entry,
	index,
	tile,
	change,
}: {
	entry: CostEntry;
	index: number;
	tile: Tile;
	change: (entry: CostEntry) => void;
}) {
	const { documents } = useBattlePassData();
	const [expanded, setExpanded] = useState(false);
	const input = useRef<HTMLInputElement>(null);
	useEffect(() => {
		if (expanded) {
			input.current?.focus();
			input.current?.select();
		}
	}, [expanded, entry.key]);
	const name = documents.find((doc) => doc.key === entry.key)?.name;
	return (
		<div
			className="grid h-8 min-w-0 rounded border border-dashed border-highlight/30 bg-surface-raised/60"
			style={{ gridTemplateColumns: entry.key ? "repeat(2, minmax(0, 1fr))" : "minmax(0, 1fr)" }}
		>
			<DropdownMenu modal={false}>
				<DropdownMenuTrigger asChild>
					<button
						type="button"
						className="flex h-full min-w-0 cursor-pointer items-center justify-center rounded focus-visible:outline-2 focus-visible:outline-brand"
						aria-label={`Choose document ${index + 1}: ${tile.displayName}`}
						title={name ? documentDisplayName(name) : `Document ${index + 1}`}
					>
						{entry.key ? (
							<DocumentIcon documentKey={entry.key} className="size-6 max-w-full" />
						) : (
							<Plus size={18} className="text-muted-foreground" aria-hidden />
						)}
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent
					side="top"
					align="start"
					className="w-56 max-w-[calc(100vw-2rem)]"
					collisionPadding={{ top: 8, right: 8, bottom: 72, left: 8 }}
					onCloseAutoFocus={(event) => {
						if (input.current) {
							event.preventDefault();
							input.current.focus();
						}
					}}
				>
					{documents.map((doc) => (
						<DropdownMenuItem
							key={doc.key}
							className="gap-2 py-1 text-xs"
							onSelect={() => {
								change({ ...entry, key: doc.key });
								setExpanded(true);
							}}
						>
							<DocumentIcon documentKey={doc.key} className="size-6 shrink-0" />
							{documentDisplayName(doc.name)}
						</DropdownMenuItem>
					))}
					{entry.key && (
						<DropdownMenuItem
							onSelect={() => {
								change({ key: "", quantity: "" });
								setExpanded(false);
							}}
						>
							Clear document {index + 1}
						</DropdownMenuItem>
					)}
				</DropdownMenuContent>
			</DropdownMenu>
			{entry.key &&
				(expanded ? (
					<input
						ref={input}
						type="text"
						inputMode="numeric"
						pattern="[0-9]*"
						value={entry.quantity}
						aria-label={`Quantity for document ${index + 1}: ${tile.displayName}`}
						className="h-full w-full min-w-0 rounded bg-background/70 px-0.5 text-center text-xs tabular-nums text-foreground focus-visible:outline-2 focus-visible:outline-brand"
						onChange={(event) => {
							if (/^\d*$/.test(event.target.value)) change({ ...entry, quantity: event.target.value });
						}}
						onKeyDown={(event) => {
							if (event.key === "Enter") {
								event.preventDefault();
								event.stopPropagation();
								setExpanded(false);
							}
						}}
					/>
				) : (
					<button
						type="button"
						className="h-full min-w-0 cursor-pointer truncate text-center text-xs tabular-nums focus-visible:outline-2 focus-visible:outline-brand"
						aria-label={`Edit document ${index + 1}: ${tile.displayName}`}
						onClick={() => setExpanded(true)}
					>
						{entry.quantity || "—"}
					</button>
				))}
		</div>
	);
}

export function RewardCostEditor({
	tile,
	entries,
	requiredTypes,
	onChange,
}: {
	tile: Tile;
	entries: CostEntry[] | undefined;
	requiredTypes: number;
	onChange: (entries: CostEntry[]) => void;
}) {
	const slots = Array.from({ length: requiredTypes }, (_, index) => entries?.[index] ?? { key: "", quantity: "" });
	return (
		<div
			className="grid gap-1"
			style={{ gridTemplateColumns: `repeat(${Math.min(6, slots.length)}, minmax(0, 1fr))` }}
			role="group"
			aria-label={`Document costs: ${tile.displayName}`}
		>
			{slots.map((entry, index) => (
				<CostSlot
					key={index}
					{...{ entry, index, tile }}
					change={(next) => onChange(slots.map((slot, i) => (i === index ? next : slot)))}
				/>
			))}
		</div>
	);
}

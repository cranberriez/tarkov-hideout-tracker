"use client";
import { useBattlePassData } from "../../BattlePassSeason";

import { useState, type CSSProperties, type SyntheticEvent } from "react";
import { Check, FileText, MapPin } from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Artwork } from "./Artwork";
import { documentDisplayName } from "../../lib/battle-pass-display";
import { cn } from "@/lib/utils";
import styles from "../../battle-pass.module.css";

export function DocumentChip({
	doc,
	amount,
	end = false,
	fulfilled = false,
	partial = false,
	large = false,
	inventory = false,
	original,
	swap,
}: {
	doc: { key: string; name: string; img?: string };
	amount?: number;
	end?: boolean;
	fulfilled?: boolean;
	partial?: boolean;
	large?: boolean;
	/** Fill an inventory card with square artwork; its name and mark are rendered above it. */
	inventory?: boolean;
	/** Snapshot document name when the player swapped this line's type; marks the chip. */
	original?: string;
	/** Edit mode: the menu picks a replacement type instead of listing locations. */
	swap?: {
		options: { key: string; name: string; img?: string }[];
		baseline: string;
		locked: boolean;
		onSelect: (key: string) => void;
	};
}) {
	const { documentMarks, locations, mapNames } = useBattlePassData();
	const [placement, setPlacement] = useState({ end, width: 280 });
	const placeLabel = (event: SyntheticEvent<HTMLElement>) => {
		const box = event.currentTarget.getBoundingClientRect();
		const left = box.left - 16;
		const right = window.innerWidth - box.right - 16;
		const alignEnd = right < 280 && left > right;
		setPlacement({ end: alignEnd, width: Math.min(280, Math.max(80, alignEnd ? left : right)) });
	};
	const mark = documentMarks[doc.key ?? ""];
	const displayName = documentDisplayName(doc.name);
	const maps = mapNames[doc.key] ?? [];
	const changedFrom = original ? `Changed from ${documentDisplayName(original)}` : undefined;
	// Reward costs: a fixed square with the amount and type mark on the artwork.
	const compact = amount !== undefined && !large;
	const artSize = large ? "h-14 w-14" : compact ? "h-[50px] w-[50px]" : "h-11 w-11";
	return (
		<DropdownMenu modal={false}>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					onMouseEnter={placeLabel}
					onFocus={placeLabel}
					style={{ "--label-width": `${placement.width}px`, "--doc-color": mark?.color } as CSSProperties}
					aria-label={`${displayName}${amount !== undefined ? `: ${amount}` : ""}${changedFrom ? ` (${changedFrom.toLowerCase()})` : ""}${fulfilled ? ", available in inventory" : partial ? ", partially covered by owned documents" : ""}. ${swap ? (swap.locked ? "Completed, locked" : "Change document type") : "Show locations"}`}
					className={
						inventory
							? "block aspect-square w-full cursor-pointer overflow-hidden rounded-md border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
							: cn(
									styles.chip,
									"cursor-pointer border-0 bg-transparent p-0 text-left align-top",
									swap && !swap.locked && "rounded outline-dashed outline-1 outline-offset-1 outline-brand/60",
									placement.end && styles.end,
									amount === undefined && styles.documentOnly,
									large && styles.large,
									compact && styles.compact,
								)
					}
				>
					{inventory ? (
						doc.img ? (
							<Artwork
								src={doc.img}
								sizes="160px"
								// Classified artwork is a tall icon padded to 258x512; fit it and scale past the padding.
								className={cn(
									"h-full w-full",
									doc.key === "classified" ? "scale-150 !object-contain" : "!object-cover",
								)}
							/>
						) : (
							<FileText className="h-full w-full" style={{ color: mark?.color }} aria-hidden />
						)
					) : (
						<span className={styles.chipInner}>
							<span className={cn(styles.face, "items-center")}>
								<span className={cn("relative shrink-0", artSize)}>
									{doc.img ? (
										<Artwork
											src={doc.img}
											className={cn(
												artSize,
												// Classified artwork is a tall icon; tilt and offset it so it fills the square like a document photo.
												doc.key === "classified"
													? "!object-contain -translate-x-[16%] rotate-12 scale-[1.35]"
													: "!object-cover",
											)}
										/>
									) : (
										<span className={cn("grid place-items-center", artSize)} style={{ color: mark?.color }}>
											<FileText className={large ? "h-10 w-10" : "h-8 w-8"} />
										</span>
									)}
									{compact ? (
										<span
											aria-hidden
											className={cn(
												styles.amountBadge,
												doc.key === "classified" ? "text-classified" : fulfilled ? "text-success" : "text-foreground",
											)}
										>
											{mark && doc.key !== "classified" && <span className={styles.mark} data-shape={mark.shape} />}
											{amount}
										</span>
									) : (
										mark &&
										doc.key !== "classified" && <span aria-hidden className={styles.mark} data-shape={mark.shape} />
									)}
								</span>
								{amount !== undefined && !compact && (
									<span
										className={cn(
											"inline-flex items-center gap-0.5 px-1.5 font-semibold tabular-nums",
											large ? "flex-1 justify-center text-lg" : "text-xs",
											fulfilled && "text-success",
										)}
									>
										{amount}
										{fulfilled && <Check size={11} strokeWidth={2.5} aria-hidden className="shrink-0" />}
										{partial && !fulfilled && (
											<span aria-hidden className="text-warning">
												~
											</span>
										)}
									</span>
								)}
							</span>
							<span className={cn(styles.label, styles.documentLabel)}>
								<span>
									{displayName}
									<span className="mt-0.5 block text-[10px] text-muted-foreground">
										{swap ? (swap.locked ? "Completed: locked" : "Click to change type") : "Click for locations"}
									</span>
								</span>
							</span>
						</span>
					)}
				</button>
			</DropdownMenuTrigger>
			{swap ? (
				<DropdownMenuContent
					align={placement.end ? "end" : "start"}
					className="w-64 max-w-[calc(100vw-2rem)] p-1"
					aria-label={`Replace ${displayName}`}
				>
					{swap.locked ? (
						<p className="px-2 py-1.5 text-xs text-muted-foreground">
							Completed rewards are locked. Mark it incomplete to change its documents.
						</p>
					) : (
						<>
							<DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
								Replace {amount !== undefined && `${amount} × `}
								<span className="font-medium text-foreground">{displayName}</span> with
							</DropdownMenuLabel>
							{swap.options.map((option) => (
								<DropdownMenuItem
									key={option.key}
									disabled={option.key === doc.key}
									onSelect={() => swap.onSelect(option.key)}
									className="gap-2"
								>
									<span
										aria-hidden
										className="relative h-8 w-8 shrink-0"
										style={{ "--doc-color": documentMarks[option.key]?.color } as CSSProperties}
									>
										{option.img ? (
											<Artwork src={option.img} className="h-8 w-8 !object-cover" />
										) : (
											<FileText className="h-8 w-8" style={{ color: documentMarks[option.key]?.color }} />
										)}
										{documentMarks[option.key] && (
											<span className={styles.mark} data-shape={documentMarks[option.key].shape} />
										)}
									</span>
									<span className="min-w-0 flex-1 truncate">{documentDisplayName(option.name)}</span>
									{option.key === swap.baseline && <span className="text-[10px] text-muted-foreground">Original</span>}
								</DropdownMenuItem>
							))}
						</>
					)}
				</DropdownMenuContent>
			) : (
				<DropdownMenuContent
					align={placement.end ? "end" : "start"}
					className="w-64 max-w-[calc(100vw-2rem)] p-3"
					aria-label={`${displayName} locations`}
				>
					<DropdownMenuLabel className="p-0 text-sm">{displayName}</DropdownMenuLabel>
					{doc.key === "classified" ? (
						<div className="mt-2 space-y-2 text-xs text-muted-foreground">
							<p className="text-foreground">{locations.classified.source}</p>
							<p>{locations.classified.note}</p>
						</div>
					) : maps.length > 0 ? (
						<>
							<ul className="mt-2 space-y-2 text-sm" aria-label="Found on maps">
								{maps.map((map) => (
									<li key={map} className="flex items-center gap-2">
										<MapPin size={14} className="text-muted-foreground" aria-hidden />
										{map}
									</li>
								))}
							</ul>
							<p className="mt-3 text-xs text-muted-foreground">Possible spawns, not guaranteed pickups.</p>
						</>
					) : (
						<p className="mt-2 text-xs text-muted-foreground">No locations available for this document.</p>
					)}
				</DropdownMenuContent>
			)}
		</DropdownMenu>
	);
}

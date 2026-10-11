"use client";
import { useState, type CSSProperties, type SyntheticEvent } from "react";
import { Check, FileText, MapPin } from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Artwork } from "./Artwork";
import { documentDisplayName, documentMarks, locations, mapNames } from "../../lib/battle-pass-display";
import { cn } from "@/lib/utils";
import styles from "../../battle-pass.module.css";

export function DocumentChip({
	doc,
	amount,
	end = false,
	fulfilled = false,
}: {
	doc: { key: string; name: string; img?: string };
	amount?: number;
	end?: boolean;
	fulfilled?: boolean;
}) {
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
	return (
		<DropdownMenu modal={false}>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					onMouseEnter={placeLabel}
					onFocus={placeLabel}
					style={{ "--label-width": `${placement.width}px`, "--doc-color": mark?.color } as CSSProperties}
					aria-label={`${displayName}${amount !== undefined ? `: ${amount}` : ""}${fulfilled ? ", available in inventory" : ""}. Show locations`}
					className={cn(
						styles.chip,
						"cursor-pointer border-0 bg-transparent p-0 text-left align-top",
						placement.end && styles.end,
						amount === undefined && styles.documentOnly,
					)}
				>
					<span className={styles.chipInner}>
						<span className={cn(styles.face, "items-center")}>
							<span className="relative h-11 w-11 shrink-0">
								{doc.img ? (
									<Artwork src={doc.img} className="h-11 w-11 !object-cover" />
								) : (
									<span className="grid h-11 w-11 place-items-center" style={{ color: mark?.color }}>
										<FileText className="h-8 w-8" />
									</span>
								)}
								{mark && <span aria-hidden className={styles.mark} data-shape={mark.shape} />}
							</span>
							{amount !== undefined && (
								<span
									className={cn(
										"inline-flex items-center gap-0.5 px-1.5 text-xs font-semibold tabular-nums",
										fulfilled && "text-success",
									)}
								>
									{amount}
									{fulfilled && <Check size={11} strokeWidth={2.5} aria-hidden className="shrink-0" />}
								</span>
							)}
						</span>
						<span className={cn(styles.label, styles.documentLabel)}>
							<span>
								{displayName}
								<span className="mt-0.5 block text-[10px] text-muted-foreground">Click for locations</span>
							</span>
						</span>
					</span>
				</button>
			</DropdownMenuTrigger>
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
		</DropdownMenu>
	);
}

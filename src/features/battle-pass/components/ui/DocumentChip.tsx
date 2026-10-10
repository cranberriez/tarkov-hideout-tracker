"use client";
import { useState, type CSSProperties, type SyntheticEvent } from "react";
import { FileText } from "lucide-react";
import { Artwork } from "./Artwork";
import { documentMarks } from "../../lib/battle-pass-display";
import { cn } from "@/lib/utils";
import styles from "../../battle-pass.module.css";

export function DocumentChip({
	doc,
	amount,
	end = false,
}: {
	doc: { key?: string; name: string; img?: string };
	amount?: number;
	end?: boolean;
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
	return (
		<span
			tabIndex={0}
			onMouseEnter={placeLabel}
			onFocus={placeLabel}
			style={{ "--label-width": `${placement.width}px`, "--doc-color": mark?.color } as CSSProperties}
			aria-label={`${doc.name}${amount !== undefined ? `: ${amount}` : ""}`}
			className={cn(styles.chip, placement.end && styles.end, amount === undefined && styles.documentOnly)}
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
					{amount !== undefined && <span className="px-1.5 text-xs font-semibold tabular-nums">{amount}</span>}
				</span>
				<span className={cn(styles.label, styles.documentLabel)}>{doc.name}</span>
			</span>
		</span>
	);
}

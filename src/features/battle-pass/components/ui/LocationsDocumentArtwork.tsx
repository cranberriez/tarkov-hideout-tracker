"use client";
import Image from "next/image";
import { useState, type CSSProperties } from "react";
import { FileText } from "lucide-react";
import { documentLocationArtwork } from "../../lib/battle-pass-document-artwork";
import { documentMarks } from "../../lib/battle-pass-display";
import { cn } from "@/lib/utils";
import styles from "../../battle-pass.module.css";

/** Locations alone use the transparent item artwork, retaining the source fallback. */
export function LocationsDocumentArtwork({
	doc,
	className,
}: {
	doc: { key: string; img?: string };
	className?: string;
}) {
	const sources = [...new Set([documentLocationArtwork[doc.key]?.image512pxLink, doc.img].filter(Boolean))];
	const [sourceIndex, setSourceIndex] = useState(0);
	const src = sources[sourceIndex];
	const mark = documentMarks[doc.key];
	return (
		<span className={cn("relative inline-block", className)}>
			{src ? (
				<Image
					src={src}
					fill
					sizes="64px"
					alt=""
					loading="lazy"
					onError={() => setSourceIndex((index) => index + 1)}
					className="h-full w-full object-contain"
				/>
			) : (
				<FileText aria-label="Image unavailable" className="h-full w-full object-contain text-subtle-foreground" />
			)}
			{mark && (
				<span
					aria-hidden
					className={styles.mark}
					data-shape={mark.shape}
					style={{ "--doc-color": mark.color } as CSSProperties}
				/>
			)}
		</span>
	);
}

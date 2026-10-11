"use client";
/* eslint-disable @next/next/no-img-element -- Source CDN artwork, no image proxy required. */
import { useState } from "react";
import { FileText } from "lucide-react";
import { documentLocationArtwork } from "../../lib/battle-pass-document-artwork";
import { cn } from "@/lib/utils";

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
	return src ? (
		<img
			src={src}
			alt=""
			loading="lazy"
			onError={() => setSourceIndex((index) => index + 1)}
			className={cn("object-contain", className)}
		/>
	) : (
		<FileText aria-label="Image unavailable" className={cn("text-subtle-foreground", className)} />
	);
}

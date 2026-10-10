"use client";
/* eslint-disable @next/next/no-img-element -- Source CDN artwork, no image proxy required. */
import { useState } from "react";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export function Artwork({ src, className = "" }: { src: string; className?: string }) {
	const [failed, setFailed] = useState(false);
	return failed ? (
		<FileText aria-label="Image unavailable" className={cn("text-subtle-foreground", className)} />
	) : (
		<img src={src} alt="" loading="lazy" onError={() => setFailed(true)} className={cn("object-contain", className)} />
	);
}

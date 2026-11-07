"use client";
import Image from "next/image";
import { useState } from "react";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { generatedBattlePassArtwork } from "@/lib/generated-battle-pass-artwork";

export function Artwork({ src, className = "", sizes = "44px" }: { src: string; className?: string; sizes?: string }) {
	const [failed, setFailed] = useState(false);
	const [useOriginal, setUseOriginal] = useState(false);
	const variants = generatedBattlePassArtwork(src);
	return failed ? (
		<FileText aria-label="Image unavailable" className={cn("text-subtle-foreground", className)} />
	) : (
		<Image
			src={!useOriginal ? (variants?.[sizes === "44px" ? 0 : 1] ?? src) : src}
			unoptimized={!!variants && !useOriginal}
			alt=""
			width={512}
			height={512}
			sizes={sizes}
			loading="lazy"
			onError={() => (variants && !useOriginal ? setUseOriginal(true) : setFailed(true))}
			className={cn("object-contain", className)}
		/>
	);
}

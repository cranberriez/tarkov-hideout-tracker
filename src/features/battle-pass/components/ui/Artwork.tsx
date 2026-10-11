"use client";
import Image from "next/image";
import { useState } from "react";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export function Artwork({ src, className = "", sizes = "44px" }: { src: string; className?: string; sizes?: string }) {
	const [failed, setFailed] = useState(false);
	return failed ? (
		<FileText aria-label="Image unavailable" className={cn("text-subtle-foreground", className)} />
	) : (
		<Image
			src={src}
			alt=""
			width={512}
			height={512}
			sizes={sizes}
			loading="lazy"
			onError={() => setFailed(true)}
			className={cn("object-contain", className)}
		/>
	);
}

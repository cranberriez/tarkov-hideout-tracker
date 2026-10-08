"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { Check, CircleCheckBig, PackageOpen, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { itemImageCandidates, type ItemImageSource } from "@/lib/utils/item-images";

export type ItemThumbnailSize = "xs" | "sm" | "md" | "lg";

const pixels: Record<ItemThumbnailSize, number> = { xs: 20, sm: 32, md: 44, lg: 64 };

/** Name-only items (unknown references) render the missing-image placeholder. */
export interface ThumbnailItem extends Partial<ItemImageSource> {
	name: string;
}

export interface ItemImageAppearance {
	item: ThumbnailItem;
	/** Square edge in pixels, or an existing thumbnail size. Defaults to 44px. */
	size?: number | ItemThumbnailSize;
	framed?: boolean;
	foundInRaid?: boolean;
	/** Reusable tool marker in the bottom-left corner. */
	tool?: boolean;
	/** Grayscale the art, hide informational overlays, and show a centered check. */
	completed?: boolean;
	selected?: boolean;
	/** A count or formatted progress, e.g. 3 or "3/5". */
	quantity?: number | string;
	className?: string;
	/** Extra noninteractive overlays, such as a price or tool badge; hidden when completed. */
	children?: ReactNode;
}

/** Item icon with a stable box and explicit missing-image placeholder. */
export function ItemThumbnail({
	item,
	size = "md",
	framed = false,
	className,
	children,
	foundInRaid = false,
	tool = false,
	completed = false,
	selected = false,
	quantity,
}: ItemImageAppearance) {
	const edge = typeof size === "number" ? size : pixels[size];
	const sources = item.id
		? itemImageCandidates(item as ItemImageSource, ["icon", "512", "grid", "base"])
		: [item.iconLink, item.image512pxLink, item.gridImageLink, item.baseImageLink].filter((src): src is string =>
				Boolean(src?.trim()),
			);
	return (
		<span
			style={{ width: edge, height: edge }}
			className={cn(
				"relative inline-flex shrink-0 items-center justify-center align-middle",
				framed && "border border-highlight/12 bg-shadow/30",
				className,
			)}
		>
			<ThumbnailSource key={JSON.stringify(sources)} sources={sources} edge={edge} completed={completed} />
			{selected && <span aria-hidden="true" className="pointer-events-none absolute inset-px border border-brand" />}
			{foundInRaid && !completed && (
				<CircleCheckBig
					aria-label="Found in raid"
					role="img"
					strokeWidth={3}
					className="absolute -right-px -top-px size-3 rounded-full bg-background text-fir"
				/>
			)}
			{completed && (
				<span
					aria-label="Completed"
					role="img"
					className="pointer-events-none absolute inset-0 flex items-center justify-center bg-shadow/40 text-success"
				>
					<Check aria-hidden="true" size={Math.min(24, edge / 2)} strokeWidth={2} />
				</span>
			)}
			{!completed && tool && (
				<span
					role="img"
					aria-label="Reusable tool"
					title="Reusable tool (not consumed)"
					className="absolute -bottom-px -left-px inline-flex bg-background/90 p-0.5 text-info"
				>
					<Wrench size={12} fill="currentColor" strokeWidth={1.5} aria-hidden="true" />
				</span>
			)}
			{!completed && quantity !== undefined && <ItemQuantityBadge label={String(quantity)} />}
			{!completed && children}
		</span>
	);
}

function ThumbnailSource({ sources, edge, completed }: { sources: string[]; edge: number; completed: boolean }) {
	const [index, setIndex] = useState(0);
	const src = sources[index];
	return src ? (
		<Image
			src={src}
			alt=""
			width={edge}
			height={edge}
			unoptimized
			onError={() => setIndex((current) => current + 1)}
			className={cn("size-full object-contain", completed && "opacity-50 grayscale")}
		/>
	) : (
		<PackageOpen
			aria-hidden="true"
			className={cn("size-1/2 text-subtle-foreground", completed && "opacity-50 grayscale")}
		/>
	);
}

/** Bottom-right count overlay for an `ItemThumbnail`. */
export function ItemQuantityBadge({ label, className }: { label: string; className?: string }) {
	return (
		<span
			className={cn(
				"absolute -bottom-px -right-px inline-flex min-w-4 items-center justify-center bg-background/90 px-1 py-0.5 font-mono text-[10px] font-semibold leading-none text-foreground",
				className,
			)}
		>
			{label}
		</span>
	);
}

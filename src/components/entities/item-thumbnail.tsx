"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { Check, CircleCheckBig, PackageOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export type ItemThumbnailSize = "xs" | "sm" | "md" | "lg";

const pixels: Record<ItemThumbnailSize, number> = { xs: 20, sm: 32, md: 44, lg: 64 };

export interface ThumbnailItem {
	name: string;
	iconLink?: string | null;
	gridImageLink?: string | null;
	image512pxLink?: string | null;
	baseImageLink?: string | null;
}

export interface ItemImageAppearance {
	item: ThumbnailItem;
	/** Square edge in pixels, or an existing thumbnail size. Defaults to 44px. */
	size?: number | ItemThumbnailSize;
	framed?: boolean;
	foundInRaid?: boolean;
	completed?: boolean;
	selected?: boolean;
	/** A count or formatted progress, e.g. 3 or "3/5". */
	quantity?: number | string;
	className?: string;
	/** Extra noninteractive overlays, such as a price or tool badge. */
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
	completed = false,
	selected = false,
	quantity,
}: ItemImageAppearance) {
	const edge = typeof size === "number" ? size : pixels[size];
	const sources = [
		...new Set(
			[item.iconLink, item.image512pxLink, item.gridImageLink, item.baseImageLink].filter((src): src is string =>
				Boolean(src?.trim()),
			),
		),
	];
	return (
		<span
			style={{ width: edge, height: edge }}
			className={cn(
				"relative inline-flex shrink-0 items-center justify-center align-middle",
				framed && "rounded-sm border border-highlight/12 bg-shadow/30",
				className,
			)}
		>
			<ThumbnailSource key={JSON.stringify(sources)} sources={sources} edge={edge} />
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
					className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-background bg-success text-inverse shadow-sm"
				>
					<Check aria-hidden="true" size={10} strokeWidth={3} />
				</span>
			)}
			{quantity !== undefined && <ItemQuantityBadge label={String(quantity)} />}
			{children}
		</span>
	);
}

function ThumbnailSource({ sources, edge }: { sources: string[]; edge: number }) {
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
			className="size-full object-contain"
		/>
	) : (
		<PackageOpen aria-hidden="true" className="size-1/2 text-subtle-foreground" />
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

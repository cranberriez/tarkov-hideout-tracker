"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { FloatingPortal, useFloatingPreview } from "@/components/ui/floating-preview";
import { cn } from "@/lib/utils";
import type { StoryImage } from "@/types/story";

/**
 * Thumbnails are small pre-made files, so they skip optimization. The full image is
 * optimized and only requested once the hover preview or dialog renders it.
 */
function Thumbnail({ image, onOpen }: { image: StoryImage; onOpen: () => void }) {
	const preview = useFloatingPreview({ placement: "right-start", openDelay: 150, closeDelay: 60 });
	return (
		<>
			<button
				{...preview.triggerProps}
				type="button"
				onClick={onOpen}
				aria-label={`View image: ${image.caption}`}
				className="overflow-hidden rounded border border-highlight/15 transition-colors hover:border-brand/50"
			>
				<Image src={image.thumb} alt="" width={100} height={60} unoptimized className="h-15 w-25 object-cover" />
			</button>
			<FloatingPortal
				open={preview.open}
				floatingProps={preview.floatingProps}
				className="pointer-events-none w-[min(32rem,calc(100vw-1rem))] rounded-md border border-highlight/15 bg-surface-raised p-1.5 shadow-xl"
			>
				<Image
					src={image.src}
					alt=""
					width={1280}
					height={720}
					loading="eager"
					sizes="512px"
					className="h-auto max-h-[60vh] w-full rounded-sm object-contain"
				/>
				<p className="px-1 pt-1 text-xs text-muted-foreground">{image.caption}</p>
			</FloatingPortal>
		</>
	);
}

/** Step thumbnails that open full size, with arrows between the step's images. */
export function StoryStepImages({ images, stepText }: { images: StoryImage[]; stepText: string }) {
	const [openIndex, setOpenIndex] = useState<number | null>(null);
	const current = openIndex === null ? null : images[openIndex];
	const step = (delta: number) =>
		setOpenIndex((index) => (index === null ? null : (index + delta + images.length) % images.length));
	return (
		<>
			<div className="mt-1.5 flex flex-wrap gap-1.5">
				{images.map((image, index) => (
					<Thumbnail key={image.src} image={image} onOpen={() => setOpenIndex(index)} />
				))}
			</div>
			<Dialog open={current !== null} onOpenChange={(open) => !open && setOpenIndex(null)}>
				<DialogContent
					className="flex max-h-[calc(100dvh-2rem)] flex-col gap-2 p-3 sm:max-w-5xl"
					onKeyDown={(event) => {
						if (event.key === "ArrowRight") step(1);
						if (event.key === "ArrowLeft") step(-1);
					}}
				>
					{current && (
						<>
							<DialogTitle className="pr-8 text-sm">{stepText}</DialogTitle>
							<Image
								key={current.src}
								src={current.src}
								alt={current.caption}
								width={1280}
								height={720}
								loading="eager"
								sizes="(min-width: 1024px) 1000px, 100vw"
								className="h-auto max-h-[calc(100dvh-9rem)] w-full rounded object-contain"
							/>
							<div className="flex items-center gap-2">
								<DialogDescription className="flex-1 text-xs">{current.caption}</DialogDescription>
								{images.length > 1 && (
									<>
										<span className="text-xs text-muted-foreground tabular-nums">
											{(openIndex ?? 0) + 1} / {images.length}
										</span>
										{[
											{ delta: -1, label: "Previous image", Icon: ChevronLeft },
											{ delta: 1, label: "Next image", Icon: ChevronRight },
										].map(({ delta, label, Icon }) => (
											<button
												key={label}
												type="button"
												onClick={() => step(delta)}
												aria-label={label}
												className={cn(
													"rounded border border-highlight/15 p-1 text-muted-foreground transition-colors",
													"hover:border-brand/50 hover:text-foreground",
												)}
											>
												<Icon aria-hidden="true" className="size-4" />
											</button>
										))}
									</>
								)}
							</div>
						</>
					)}
				</DialogContent>
			</Dialog>
		</>
	);
}

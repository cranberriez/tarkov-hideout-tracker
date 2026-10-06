"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { StoryImage } from "@/types/story";

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
					<button
						key={image.src}
						type="button"
						onClick={() => setOpenIndex(index)}
						title={image.caption}
						aria-label={`View image: ${image.caption}`}
						className="overflow-hidden rounded border border-highlight/15 transition-colors hover:border-brand/50"
					>
						<img src={image.src} alt="" loading="lazy" className="h-12 w-20 object-cover" />
					</button>
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
							<img
								src={current.src}
								alt={current.caption}
								className="max-h-[calc(100dvh-9rem)] w-full rounded object-contain"
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

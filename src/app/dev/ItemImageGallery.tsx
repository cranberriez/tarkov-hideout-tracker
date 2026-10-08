"use client";

import { useState, type ReactNode } from "react";
import { ItemImage } from "@/components/entities/item-image";

const item = {
	id: "544fb45d4bdc2dee738b4568",
	name: "Salewa first aid kit",
	iconLink: "https://assets.tarkov.dev/544fb45d4bdc2dee738b4568-icon.webp",
};

function Example({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="flex min-w-0 flex-col items-start gap-5 rounded-md border border-border p-4">
			<div className="flex min-h-16 items-center gap-4">{children}</div>
			<code className="break-words text-xs text-muted-foreground">{label}</code>
		</div>
	);
}

export function ItemImageGallery() {
	const [clicks, setClicks] = useState(0);
	const [selected, setSelected] = useState(false);
	return (
		<section aria-labelledby="item-image-gallery" className="space-y-6 rounded-xl border border-border bg-card p-5">
			<header className="space-y-2">
				<h2 id="item-image-gallery" className="text-xl font-semibold">
					ItemImage playground
				</h2>
				<p className="text-sm text-muted-foreground">
					One required prop: item. A plain 44px square by default. These examples do not change saved progress.
				</p>
				<pre className="overflow-x-auto rounded-md bg-background p-3 text-xs">
					{
						'<ItemImage item={item} />\n// item = { name: "Salewa first aid kit", iconLink: "…" }\n// Add a real item id when using opensModal.'
					}
				</pre>
			</header>
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<Example label="item={item}">
					<ItemImage item={item} />
				</Example>
				<Example label="foundInRaid quantity={3}">
					<ItemImage item={item} foundInRaid quantity={3} />
				</Example>
				<Example label={'quantity="3/5"'}>
					<ItemImage item={item} quantity="3/5" />
				</Example>
				<Example label="quantity={0}">
					<ItemImage item={item} quantity={0} />
				</Example>
			</div>
			<h3 className="font-semibold">Sizes</h3>
			<p className="text-sm text-muted-foreground">
				Use a pixel size or xs (20), sm (32), md (44), lg (64). Images always fit without cropping.
			</p>
			<div className="flex flex-wrap items-end gap-6">
				{[20, 22, 24, 28, 32, 36, 40, 44, 48, 64, 80, 112].map((size) => (
					<div key={size} className="space-y-2">
						<ItemImage item={item} size={size} framed />
						<p className="text-xs text-muted-foreground">{size}px</p>
					</div>
				))}
			</div>
			<h3 className="font-semibold">All 32 visual combinations</h3>
			<p className="text-sm text-muted-foreground">
				Every combination of FiR, completed, selected, framed, and quantity. Click behavior is independent.
			</p>
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
				{Array.from({ length: 32 }, (_, mask) => {
					const foundInRaid = Boolean(mask & 1),
						completed = Boolean(mask & 2),
						selected = Boolean(mask & 4),
						framed = Boolean(mask & 8),
						quantity = mask & 16 ? "3/5" : undefined;
					const label =
						[
							foundInRaid && "FiR",
							completed && "completed",
							selected && "selected",
							framed && "framed",
							quantity && "quantity",
						]
							.filter(Boolean)
							.join(" + ") || "baseline";
					return (
						<Example key={mask} label={label}>
							<ItemImage
								item={item}
								foundInRaid={foundInRaid}
								completed={completed}
								selected={selected}
								framed={framed}
								quantity={quantity}
							/>
						</Example>
					);
				})}
			</div>
			<h3 className="font-semibold">Interaction</h3>
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<Example label="opensModal (hover preview enabled)">
					<ItemImage item={item} opensModal />
				</Example>
				<Example label="opensModal preview={false}">
					<ItemImage item={item} opensModal preview={false} />
				</Example>
				<Example label="onClick (custom action)">
					<ItemImage
						item={item}
						selected={selected}
						onClick={() => {
							setSelected(!selected);
							setClicks(clicks + 1);
						}}
						aria-label="Toggle sample selection"
					/>
				</Example>
				<Example label="inside an existing button">
					<button
						type="button"
						onClick={() => setClicks(clicks + 1)}
						className="flex items-center gap-3 rounded border border-border p-2 focus-visible:outline-2 focus-visible:outline-brand"
					>
						<ItemImage item={item} size={32} />
						Add sample
					</button>
				</Example>
				<Example label="opensModal + all visual props">
					<ItemImage item={item} opensModal foundInRaid completed selected framed quantity="3/5" size={64} />
				</Example>
				<Example label="opensModal + onClick (preventDefault cancels modal)">
					<ItemImage
						item={item}
						opensModal
						preview={false}
						onClick={(event) => {
							event.preventDefault();
							setClicks(clicks + 1);
						}}
						aria-label="Run custom action without opening details"
					/>
				</Example>
			</div>
			<p role="status" className="text-sm text-muted-foreground">
				Custom actions: {clicks}. Sample selection: {selected ? "selected" : "unselected"}.
			</p>
			<h3 className="font-semibold">Fallbacks and extra overlays</h3>
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<Example label="completed: grayscale, centered check, hidden overlays">
					<ItemImage item={item} size={64} framed completed foundInRaid quantity="3/5" className="p-1">
						<span className="absolute left-0 top-0">₽12k</span>
						<span className="absolute bottom-0 left-0">Tool</span>
					</ItemImage>
				</Example>
				<Example label={'item={{ name: "Unknown item" }}'}>
					<ItemImage item={{ name: "Unknown item" }} />
				</Example>
				<Example label="broken image → placeholder">
					<ItemImage item={{ name: "Broken image", iconLink: "/__dev_missing_item__.webp" }} />
				</Example>
				<Example label="broken icon → next available source">
					<ItemImage item={{ ...item, iconLink: "/__dev_missing_item__.webp", image512pxLink: item.iconLink }} />
				</Example>
				<Example label="tool boolean + custom price overlay">
					<ItemImage item={item} size={80} framed foundInRaid tool quantity={2}>
						<span className="absolute -left-px -top-px bg-background/90 px-1 py-0.5 font-mono text-[10px] font-semibold leading-none text-foreground">
							₽12k
						</span>
					</ItemImage>
				</Example>
			</div>
		</section>
	);
}

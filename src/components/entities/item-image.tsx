"use client";

import type { MouseEventHandler } from "react";
import { ItemLink, type PreviewItem } from "./item-link";
import { ItemThumbnail, type ItemImageAppearance } from "./item-thumbnail";

export type ItemImageProps = ItemImageAppearance & {
	/** Custom action. With opensModal, preventDefault() cancels opening the dialog. */
	onClick?: MouseEventHandler<HTMLButtonElement>;
	/** Accessible action name; defaults to the item name and visible status. */
	"aria-label"?: string;
} & ({ opensModal: true; item: PreviewItem; preview?: boolean } | { opensModal?: false; preview?: never });

/** Minimal usage: <ItemImage item={item} />. Display-only unless given an action. */
export function ItemImage({
	opensModal = false,
	preview = true,
	onClick,
	"aria-label": ariaLabel,
	...appearance
}: ItemImageProps) {
	const { item, foundInRaid, tool, completed, quantity, selected } = appearance;
	const label =
		ariaLabel ??
		[
			item.name,
			!completed && foundInRaid && "found in raid",
			!completed && tool && "reusable tool",
			completed && "completed",
			!completed && quantity !== undefined && `quantity ${quantity}`,
			selected && "selected",
		]
			.filter(Boolean)
			.join(", ");
	const image = <ItemThumbnail {...appearance} />;
	const focusClass = "inline-flex focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand";
	if (opensModal) {
		return (
			<ItemLink
				item={item as PreviewItem}
				preview={preview}
				onClick={onClick}
				aria-label={label}
				className={focusClass}
			>
				{image}
			</ItemLink>
		);
	}
	if (onClick) {
		return (
			<button type="button" onClick={onClick} aria-label={label} className={`${focusClass} cursor-pointer`}>
				{image}
			</button>
		);
	}
	return (
		<span
			role="img"
			aria-label={label}
			aria-hidden={ariaLabel === "" || undefined}
			className="inline-flex shrink-0 align-middle"
		>
			{image}
		</span>
	);
}

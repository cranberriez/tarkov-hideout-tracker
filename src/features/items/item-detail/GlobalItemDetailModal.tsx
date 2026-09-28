"use client";

import { Suspense } from "react";
import { ItemDetailModal } from "./LazyItemDetailModal";
import { useItemDetailNavigationController } from "./useItemDetailNavigationController";

/** The single item-detail dialog. Every item link and search result opens it via `openItemDetail`. */
export function GlobalItemDetailModal() {
	return (
		<Suspense fallback={null}>
			<ItemDetailModalHost />
		</Suspense>
	);
}

function ItemDetailModalHost() {
	const { item, previousItem, back, close } = useItemDetailNavigationController();
	return <ItemDetailModal item={item} isOpen={!!item} previousItem={previousItem} onBack={back} onClose={close} />;
}

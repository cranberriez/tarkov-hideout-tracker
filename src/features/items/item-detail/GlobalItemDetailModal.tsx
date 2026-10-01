"use client";

import { Suspense } from "react";
import { ItemDetailModal } from "./LazyItemDetailModal";
import { useItemDetailNavigationController } from "./useItemDetailNavigationController";

/**
 * The single item-detail dialog. Item links and search results open it via `openItemDetail`;
 * recipe rows swap in a profit breakdown via `openRecipeBreakdown`.
 */
export function GlobalItemDetailModal() {
	return (
		<Suspense fallback={null}>
			<ItemDetailModalHost />
		</Suspense>
	);
}

function ItemDetailModalHost() {
	const { entry, previousEntry, back, close } = useItemDetailNavigationController();
	return <ItemDetailModal entry={entry} previousEntry={previousEntry} onBack={back} onClose={close} />;
}

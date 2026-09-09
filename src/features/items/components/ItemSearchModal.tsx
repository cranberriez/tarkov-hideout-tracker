"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { ItemSummary } from "@/types/items";
import { Search, X } from "lucide-react";
import { useUserStore } from "@/lib/stores/useUserStore";
import { toTarkovJsonGameMode } from "@/lib/game-mode";
import {
	ITEM_SEARCH_MAX_QUERY_LENGTH,
	ITEM_SEARCH_PAGE_RESULT_LIMIT,
} from "@/types/contracts";
import { useItemSearchController } from "@/features/items/useItemSearchController";

interface ItemSearchModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSelect: (item: ItemSummary) => void;
}

export function ItemSearchModal({ isOpen, onClose, onSelect }: ItemSearchModalProps) {
	const [query, setQuery] = useState("");
	const gameMode = useUserStore((state) => state.gameMode);
	const search = useItemSearchController({
		enabled: isOpen,
		mode: toTarkovJsonGameMode(gameMode),
		query,
		resultLimit: ITEM_SEARCH_PAGE_RESULT_LIMIT,
	});

	// Focus input on open
	useEffect(() => {
		if (isOpen) {
			const timer = setTimeout(() => {
				document.getElementById("item-search-input")?.focus();
			}, 50);
			return () => clearTimeout(timer);
		}
	}, [isOpen]);

	// Handle Escape to close - Handled by Dialog
	// useEffect(() => { ... }, [isOpen, onClose]);

	const handleClose = () => {
		setQuery("");
		onClose();
	};

	const handleSelect = (item: ItemSummary) => {
		setQuery("");
		onSelect(item);
	};

	if (!isOpen) return null;

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
			<DialogContent
				showCloseButton={false}
				className="top-[15%] translate-y-0 w-full md:max-w-2xl max-h-[70vh] p-0 gap-0 overflow-hidden flex flex-col"
			>
				<DialogTitle className="sr-only">Item Search</DialogTitle>
				<div className="p-4 border-b border-border-color flex items-center gap-3 bg-shadow/20">
					<Search className="text-muted-foreground" size={20} />
					<input
						id="item-search-input"
						type="text"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						maxLength={ITEM_SEARCH_MAX_QUERY_LENGTH}
						placeholder="Search items..."
						className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-subtle-foreground text-lg"
						autoComplete="off"
					/>
					<button onClick={handleClose} className="text-muted-foreground hover:text-foreground">
						<X size={20} />
					</button>
				</div>

				<div className="overflow-y-auto">
					{search.items.length > 0 ? (
						<div className="divide-y divide-highlight/5">
							{search.items.map((item) => (
								<button
									key={item.id}
									onClick={() => handleSelect(item)}
									className="w-full px-4 py-3 flex items-center gap-4 hover:bg-highlight/5 transition-colors text-left"
								>
									<div className="w-10 h-10 bg-shadow/40 border border-highlight/5 rounded flex items-center justify-center shrink-0 overflow-hidden">
										{item.iconLink ? (
											<img
												src={item.iconLink}
												alt={item.name}
												className="w-full h-full object-contain"
											/>
										) : (
											<span className="text-xs text-subtle-foreground">?</span>
										)}
									</div>
									<div>
										<div className="text-foreground font-medium">{item.name}</div>
										<div className="text-xs text-subtle-foreground">{item.category?.name}</div>
									</div>
								</button>
							))}
						</div>
					) : search.isLoading ? (
						<div className="p-8 text-center text-subtle-foreground">Searching items…</div>
					) : search.error ? (
						<div className="p-8 text-center text-danger">
							<p>{search.error}</p>
							<button
								type="button"
								onClick={() => void search.retry()}
								className="mt-3 rounded border border-current px-3 py-1.5 text-sm hover:bg-danger/10"
							>
								Retry search
							</button>
						</div>
					) : search.hasNoResults ? (
						<div className="p-8 text-center text-subtle-foreground">
							No items found matching {query.trim()}
						</div>
					) : (
						<div className="p-8 text-center text-subtle-foreground">Type to search items...</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}

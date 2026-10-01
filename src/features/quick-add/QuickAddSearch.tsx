"use client";

import { useEffect, useId, useState, type RefObject } from "react";
import Image from "next/image";
import { Search, X } from "lucide-react";
import type { ItemSummary } from "@/types/items";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { cn } from "@/lib/utils";
import { ITEM_SEARCH_MAX_QUERY_LENGTH, ITEM_SEARCH_QUICK_RESULT_LIMIT } from "@/types/contracts";
import { useItemSearchController } from "@/features/items/useItemSearchController";

export function QuickAddSearch({
	mode,
	query,
	onQueryChange,
	onPick,
	inputRef,
}: {
	mode: TarkovJsonGameMode;
	query: string;
	onQueryChange: (query: string) => void;
	onPick: (item: ItemSummary) => void;
	inputRef: RefObject<HTMLInputElement | null>;
}) {
	const [isFocused, setIsFocused] = useState(true);
	const [highlight, setHighlight] = useState(0);
	const listId = useId();
	const search = useItemSearchController({ enabled: true, mode, query, resultLimit: ITEM_SEARCH_QUICK_RESULT_LIMIT });
	const results = search.items;
	const activeIndex = results.length ? Math.min(highlight, results.length - 1) : -1;
	const optionId = (index: number) => `${listId}-${index}`;
	const isOpen = isFocused && !!query.trim();

	useEffect(() => {
		if (activeIndex >= 0) document.getElementById(`${listId}-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
	}, [activeIndex, listId]);

	return (
		<div className="relative">
			<div className="flex h-12 items-center gap-2 rounded-md border border-brand/50 bg-shadow/40 px-3 ring-brand/50 focus-within:ring-1">
				<Search size={16} className="text-muted-foreground" aria-hidden="true" />
				<input
					ref={inputRef}
					role="combobox"
					aria-label="Search items to add"
					aria-autocomplete="list"
					aria-expanded={isOpen}
					aria-controls={listId}
					aria-activedescendant={isOpen && activeIndex >= 0 ? optionId(activeIndex) : undefined}
					type="text"
					placeholder="Search item name…"
					value={query}
					maxLength={ITEM_SEARCH_MAX_QUERY_LENGTH}
					autoComplete="off"
					spellCheck={false}
					onChange={(event) => {
						setHighlight(0);
						onQueryChange(event.target.value);
					}}
					onFocus={() => setIsFocused(true)}
					onBlur={() => setIsFocused(false)}
					className="flex-1 border-none bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
					onKeyDown={(event) => {
						if (event.nativeEvent.isComposing || event.ctrlKey || event.metaKey) return;
						if (event.key === "ArrowDown" || event.key === "ArrowUp") {
							event.preventDefault();
							if (results.length)
								setHighlight((activeIndex + (event.key === "ArrowDown" ? 1 : -1) + results.length) % results.length);
						} else if ((event.key === "Enter" || (event.key === "Tab" && !event.shiftKey)) && results[activeIndex]) {
							event.preventDefault();
							onPick(results[activeIndex]);
						}
					}}
				/>
				{query && (
					<button
						type="button"
						aria-label="Clear search"
						tabIndex={-1}
						onClick={() => {
							onQueryChange("");
							inputRef.current?.focus();
						}}
						className="text-muted-foreground hover:text-foreground"
					>
						<X size={16} />
					</button>
				)}
			</div>

			{isOpen && (
				// Keep focus in the input while clicking results so the list doesn't close before the click lands.
				<div
					onMouseDown={(event) => event.preventDefault()}
					className="absolute top-full left-0 z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-border-color bg-card shadow-xl"
				>
					{search.isLoading && <div className="p-3 text-center text-xs text-muted-foreground">Searching items…</div>}
					{search.error && (
						<div className="p-3 text-center text-xs text-danger">
							<p>{search.error}</p>
							<button
								type="button"
								onClick={() => void search.retry()}
								className="mt-2 rounded border border-current px-2 py-1 hover:bg-danger/10"
							>
								Retry search
							</button>
						</div>
					)}
					{search.hasNoResults && <div className="p-3 text-center text-xs text-muted-foreground">No items found.</div>}
					<div id={listId} role="listbox" aria-label="Matching items">
						{results.map((item, index) => (
							<div
								key={item.id}
								id={optionId(index)}
								role="option"
								aria-selected={index === activeIndex}
								onMouseMove={() => index !== activeIndex && setHighlight(index)}
								onClick={() => onPick(item)}
								className={cn(
									"flex cursor-pointer items-center gap-3 border-b border-l-2 border-b-highlight/5 p-2 last:border-b-0",
									index === activeIndex ? "border-l-brand bg-brand/10" : "border-l-transparent",
								)}
							>
								<div className="relative h-8 w-8 min-w-8 overflow-hidden rounded bg-shadow/40">
									{item.iconLink && <Image src={item.iconLink} alt="" fill className="object-contain" />}
								</div>
								<span className="truncate text-sm text-foreground">{item.name}</span>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

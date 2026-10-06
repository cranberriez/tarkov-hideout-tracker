"use client";

/* eslint-disable @next/next/no-img-element -- Catalog previews. */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { ListFilter, X } from "lucide-react";
import type { ItemSummary } from "@/types/items";
import { itemImageUrl } from "@/lib/utils/item-images";
import { cn } from "@/lib/utils";
import { ITEM_GROUPS, itemGroupLabel, type ItemGroupKey } from "./item-groups";
import { searchUploaderItems } from "./item-search-model";
import { KeyHint, sectionLabel } from "./UploaderSidebarHeader";

const NONE: readonly ItemSummary[] = [];
const optionId = (idPrefix: string, item: ItemSummary) => `${idPrefix}-match-${item.id}`;

/** Results and keyboard highlight for an uploader item search; the highlight resets with `resetKey`. */
export function useItemSearch({
	idPrefix,
	items,
	query,
	group,
	baseline = NONE,
	extra = NONE,
	resetKey = "",
}: {
	idPrefix: string;
	items: readonly ItemSummary[];
	query: string;
	group: ItemGroupKey | null;
	baseline?: readonly ItemSummary[];
	extra?: readonly ItemSummary[];
	resetKey?: string;
}) {
	const results = useMemo(
		() => searchUploaderItems({ items, query, group, baseline, extra }),
		[items, query, group, baseline, extra],
	);
	const key = `${resetKey}|${query}|${group}`;
	const [highlight, setHighlight] = useState({ key: "", index: 0 });
	const highlighted = highlight.key === key ? Math.min(highlight.index, results.length - 1) : 0;
	return {
		idPrefix,
		results,
		highlighted,
		current: results[highlighted] as ItemSummary | undefined,
		key,
		setHighlighted: (index: number) => setHighlight({ key, index }),
		move: (step: 1 | -1) => {
			if (!results.length) return;
			const index = (highlighted + step + results.length) % results.length;
			setHighlight({ key, index });
			document.getElementById(optionId(idPrefix, results[index]))?.scrollIntoView({ block: "nearest" });
		},
	};
}

/** Search input with a category filter chip and a scrolling match list. */
export function UploaderItemSearch({
	search,
	query,
	onQueryChange,
	group,
	onGroupChange,
	onPick,
	onKeyDown,
	inputRef,
	label,
	placeholder,
	heading,
	emptyText,
}: {
	search: ReturnType<typeof useItemSearch>;
	query: string;
	onQueryChange: (query: string) => void;
	group: ItemGroupKey | null;
	onGroupChange: (group: ItemGroupKey | null) => void;
	onPick: (item: ItemSummary, viaKeyboard: boolean) => void;
	/** Keys the search does not handle itself. */
	onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
	inputRef: RefObject<HTMLInputElement | null>;
	label: string;
	placeholder: string;
	/** Match list title; the list is hidden while null. */
	heading: string | null;
	emptyText: string;
}) {
	const { idPrefix, results, highlighted, current } = search;
	const [picking, setPicking] = useState(false);
	const list = useRef<HTMLDivElement>(null);
	useEffect(() => {
		list.current?.scrollTo({ top: 0 });
	}, [search.key]);
	const refocus = () => inputRef.current?.focus({ preventScroll: true });
	const choose = (next: ItemGroupKey | null) => {
		onGroupChange(next);
		setPicking(false);
		refocus();
	};
	return (
		<div className="space-y-2">
			<label htmlFor={`${idPrefix}-search`} className="sr-only">
				{label}
			</label>
			<div className="flex gap-1">
				<input
					ref={inputRef}
					id={`${idPrefix}-search`}
					type="search"
					placeholder={placeholder}
					value={query}
					autoComplete="off"
					aria-controls={`${idPrefix}-matches`}
					aria-activedescendant={!picking && current ? optionId(idPrefix, current) : undefined}
					onChange={(event) => {
						onQueryChange(event.target.value);
						setPicking(false);
					}}
					onKeyDown={(event) => {
						if (event.nativeEvent.isComposing) return;
						if (picking) {
							if (event.key !== "Escape") return;
							event.preventDefault();
							setPicking(false);
						} else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
							event.preventDefault();
							search.move(event.key === "ArrowDown" ? 1 : -1);
						} else if (event.key === "Enter" && current) {
							event.preventDefault();
							onPick(current, true);
						} else onKeyDown?.(event);
					}}
					className="min-w-0 flex-1 rounded-sm border border-border-color bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-brand"
				/>
				<button
					type="button"
					aria-label="Filter by category"
					aria-expanded={picking}
					aria-controls={`${idPrefix}-categories`}
					title="Filter by category"
					onClick={() => setPicking((open) => !open)}
					className={cn(
						"shrink-0 rounded-sm border px-2.5 text-muted-foreground hover:text-foreground",
						picking || group
							? "border-brand/60 bg-brand/10 text-foreground"
							: "border-border-color hover:bg-surface-raised",
					)}
				>
					<ListFilter size={16} aria-hidden="true" />
				</button>
			</div>
			{group && (
				<button
					type="button"
					aria-label={`Remove ${itemGroupLabel(group)} filter`}
					onClick={() => choose(null)}
					className="inline-flex items-center gap-1 rounded-full border border-brand/60 bg-brand/10 py-0.5 pl-2.5 pr-1.5 text-xs text-foreground hover:border-danger/60 hover:bg-danger/10"
				>
					{itemGroupLabel(group)}
					<X size={12} aria-hidden="true" />
				</button>
			)}
			{picking ? (
				<div
					id={`${idPrefix}-categories`}
					role="group"
					aria-label="Item categories"
					className="grid grid-cols-2 gap-1"
					onKeyDown={(event) => {
						if (event.key !== "Escape") return;
						event.preventDefault();
						setPicking(false);
						refocus();
					}}
				>
					{ITEM_GROUPS.map(({ key, label: name }) => (
						<button
							key={key}
							type="button"
							aria-pressed={group === key}
							onClick={() => choose(group === key ? null : key)}
							className={cn(
								"rounded-sm border px-2 py-1.5 text-left text-xs text-foreground",
								group === key ? "border-brand/60 bg-brand/10" : "border-border-color hover:bg-surface-raised",
							)}
						>
							{name}
						</button>
					))}
				</div>
			) : (
				heading !== null && (
					<div
						id={`${idPrefix}-matches`}
						role="listbox"
						aria-label={label}
						className="border-t border-border-color pt-3"
					>
						<p className={cn(sectionLabel, "mb-1")}>
							{query.trim() || group ? `${heading} · ${results.length}` : heading}
						</p>
						<div ref={list} className="max-h-[17rem] overflow-y-auto">
							{results.map((item, rank) => (
								<button
									key={item.id}
									id={optionId(idPrefix, item)}
									role="option"
									aria-selected={rank === highlighted}
									onClick={() => {
										onPick(item, false);
										refocus();
									}}
									onMouseEnter={() => search.setHighlighted(rank)}
									className={cn(
										"mb-1 flex w-full items-center gap-2 rounded-sm border px-2 py-2 text-left text-sm text-foreground",
										rank === highlighted
											? "border-brand/60 bg-brand/10"
											: "border-border-color hover:bg-surface-raised",
									)}
								>
									<img src={itemImageUrl(item)} alt="" className="h-8 w-8 object-contain" />
									<span className="flex-1">{item.name}</span>
									{rank === highlighted && <KeyHint>↵</KeyHint>}
								</button>
							))}
						</div>
						{!results.length && <p className="py-2 text-xs text-muted-foreground">{emptyText}</p>}
					</div>
				)
			)}
		</div>
	);
}

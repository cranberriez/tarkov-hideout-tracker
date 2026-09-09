"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ArrowDown, ArrowUp, CornerDownLeft, LoaderCircle, Package, ScrollText, Search, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useSearchManifest } from "@/lib/search/useSearchManifest";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { cn } from "@/lib/utils";
import {
	buildPaletteIndex,
	parsePaletteInput,
	searchPalette,
	type SearchResult,
	type SearchKind,
} from "./search-model";

export function SearchPalette({
	mode,
	onClose,
	onSelect,
	restoreFocus,
}: {
	mode: TarkovJsonGameMode;
	onClose: () => void;
	onSelect: (result: SearchResult) => void;
	restoreFocus: () => void;
}) {
	const manifest = useSearchManifest(mode, true);
	const [query, setQuery] = useState("");
	const [kind, setKind] = useState<SearchKind | null>(null);
	const [limit, setLimit] = useState(10);
	const [active, setActive] = useState(0);
	const [retrying, setRetrying] = useState(false);
	const input = useRef<HTMLInputElement>(null);
	const selected = useRef(false);
	const listId = useId();
	const index = useMemo(() => (manifest.data ? buildPaletteIndex(manifest.data) : []), [manifest.data]);
	const matches = useMemo(() => searchPalette(index, query, kind), [index, query, kind]);
	const scopeLabel = kind === "item" ? "Item" : "Quest";
	const hasSearch = !!query.trim() || !!kind;
	const clearKind = () => {
		setKind(null);
		setActive(0);
		setLimit(10);
		input.current?.focus();
	};
	const results = matches.slice(0, limit);
	const activeIndex = Math.min(active, results.length - 1);
	const optionId = (index: number) => `${listId}-${index}`;
	useEffect(() => {
		document.getElementById(`${listId}-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
	}, [activeIndex, listId]);
	const select = (result: SearchResult) => {
		selected.current = true;
		onSelect(result);
	};
	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent
				showCloseButton={false}
				className="top-[8dvh] flex max-h-[84dvh] w-[calc(100%-1rem)] max-w-2xl translate-y-0 flex-col overflow-hidden p-0 sm:top-[12dvh] sm:max-h-[76dvh]"
				onOpenAutoFocus={(event) => {
					event.preventDefault();
					input.current?.focus();
				}}
				onCloseAutoFocus={(event) => {
					event.preventDefault();
					if (!selected.current) restoreFocus();
				}}
			>
				<DialogTitle className="sr-only">Search items and quests</DialogTitle>
				<DialogDescription className="sr-only">
					Search the catalog. Use the up and down arrows to choose a result and Enter to open it. Type i: for items or
					q: for quests. Backspace at the start removes the filter.
				</DialogDescription>
				<div className="flex shrink-0 items-center gap-3 border-b border-border-color px-4 py-3">
					<Search size={20} className="shrink-0 text-brand" aria-hidden="true" />
					{kind && (
						<button
							type="button"
							aria-label={`Remove ${scopeLabel} filter`}
							onClick={clearKind}
							className="inline-flex shrink-0 items-center gap-1 rounded border border-border-color bg-background px-2 py-1 text-xs font-medium text-foreground hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
						>
							{scopeLabel}
							<X size={12} aria-hidden="true" />
						</button>
					)}
					<input
						ref={input}
						role="combobox"
						aria-label={kind ? `Search ${kind}s` : "Search items and quests"}
						aria-autocomplete="list"
						aria-expanded={true}
						aria-controls={listId}
						aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
						value={query}
						maxLength={80}
						placeholder={kind ? `Search ${kind}s…` : "Search items and quests…"}
						autoComplete="off"
						spellCheck={false}
						className="min-w-0 flex-1 bg-transparent py-2 text-base text-foreground outline-none placeholder:text-subtle-foreground"
						onChange={(event) => {
							const parsed = parsePaletteInput(event.target.value, kind);
							setQuery(parsed.query);
							setKind(parsed.kind);
							setActive(0);
							setLimit(10);
						}}
						onKeyDown={(event) => {
							if (event.nativeEvent.isComposing) return;
							if (
								event.key === "Backspace" &&
								kind &&
								event.currentTarget.selectionStart === 0 &&
								event.currentTarget.selectionEnd === 0
							) {
								event.preventDefault();
								clearKind();
								return;
							}
							if (event.key === "ArrowDown" || event.key === "ArrowUp") {
								event.preventDefault();
								if (results.length)
									setActive((activeIndex + (event.key === "ArrowDown" ? 1 : -1) + results.length) % results.length);
							} else if (event.key === "Enter" && results[activeIndex]) {
								event.preventDefault();
								select(results[activeIndex]);
							}
						}}
					/>
					<button
						type="button"
						aria-label="Close search"
						onClick={onClose}
						className="rounded p-2 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
					>
						<X size={18} />
					</button>
				</div>
				{manifest.error && (
					<div
						role="alert"
						className="flex items-center justify-between gap-3 border-b border-border-color px-4 py-3 text-sm text-danger"
					>
						<span>
							Search could not be loaded. {manifest.data ? "Showing available results." : "Please try again."}
						</span>
						<button
							type="button"
							disabled={retrying}
							onClick={async () => {
								setRetrying(true);
								try {
									await manifest.retry();
								} catch {
									/* Query owns the displayed error. */
								} finally {
									setRetrying(false);
								}
							}}
							className="shrink-0 rounded border border-border-color px-3 py-1 text-foreground disabled:opacity-50"
						>
							{retrying ? "Retrying…" : "Retry"}
						</button>
					</div>
				)}
				{!manifest.data && !manifest.error && (
					<div role="status" className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
						<LoaderCircle size={18} className="animate-spin motion-reduce:animate-none" />
						Loading search…
					</div>
				)}
				{manifest.data && !hasSearch && (
					<div className="px-6 py-10 text-center">
						<p className="font-medium text-foreground">Find an item or quest</p>
						<p className="mt-2 text-sm text-muted-foreground">Search names or item abbreviations, like GPU.</p>
					</div>
				)}
				{manifest.data && hasSearch && !matches.length && (
					<p role="status" className="px-6 py-10 text-center text-sm text-muted-foreground">
						No {kind ? `${kind}s` : "items or quests"} match “{query}”.
					</p>
				)}
				<div
					id={listId}
					role="listbox"
					aria-label="Search results"
					className="min-h-0 overflow-y-auto overscroll-contain"
				>
					{results.map((result, index) => (
						<div
							key={`${result.kind}:${result.id}`}
							id={optionId(index)}
							role="option"
							aria-selected={index === activeIndex}
							onMouseMove={() => setActive(index)}
							onMouseDown={(event) => event.preventDefault()}
							onClick={() => select(result)}
							className={cn(
								"flex cursor-pointer items-center gap-3 border-l-2 px-4 py-3",
								index === activeIndex ? "border-brand bg-brand/10" : "border-transparent hover:bg-accent",
							)}
						>
							<div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded border border-border-color bg-background">
								{result.iconLink ? (
									<Image
										src={result.iconLink}
										alt=""
										width={40}
										height={40}
										unoptimized
										className="h-10 w-10 object-contain"
									/>
								) : result.kind === "item" ? (
									<Package size={18} className="text-muted-foreground" />
								) : (
									<ScrollText size={18} className="text-muted-foreground" />
								)}
							</div>
							<div className="min-w-0 flex-1">
								<div className="truncate text-sm font-medium text-foreground">{result.name}</div>
								<div className="mt-0.5 text-xs text-muted-foreground">
									{result.kind === "quest" ? result.trader : result.item.shortName || "Item"}
								</div>
							</div>
							<span className="shrink-0 rounded border border-border-color px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
								{result.kind}
							</span>
						</div>
					))}
				</div>
				{matches.length > limit && limit === 10 && (
					<button
						type="button"
						onClick={() => setLimit(50)}
						className="shrink-0 border-t border-border-color py-3 text-sm text-brand hover:bg-accent"
					>
						Show more results ({Math.min(matches.length, 50)})
					</button>
				)}
				<div className="flex shrink-0 items-center justify-between gap-3 border-t border-border-color bg-background/50 px-4 py-2 text-xs text-muted-foreground">
					<div className="flex gap-3">
						<span>
							<kbd className="font-semibold text-foreground">i:</kbd> Items <span aria-hidden="true">·</span>{" "}
							<kbd className="font-semibold text-foreground">q:</kbd> Quests
						</span>
						<span role="status" aria-live="polite">
							{hasSearch && manifest.data
								? `${Math.min(matches.length, limit)} of ${matches.length} results`
								: "Type a prefix to filter"}
							{kind ? " · Backspace at start to remove" : ""}
						</span>
					</div>
					<span className="hidden items-center gap-2 sm:flex">
						<ArrowUp size={12} />
						<ArrowDown size={12} /> Navigate <CornerDownLeft size={12} className="ml-2" /> Open{" "}
						<kbd className="ml-2 rounded border border-border-color px-1">Esc</kbd> Close
					</span>
				</div>
			</DialogContent>
		</Dialog>
	);
}

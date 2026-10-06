"use client";

import { useId, useLayoutEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { FILTER_MENU_GAP, FILTER_MENU_ROW, FILTER_MENU_SURFACE, FilterPanelButton } from "./filter-bar";
import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuCheckboxItem,
	DropdownMenuItem,
} from "./dropdown-menu";

/** Consumers supply the trigger summary, rows, selection state, and domain rules. */
export function FilterMultiSelect({
	label,
	summary,
	children,
	className,
	contentClassName,
}: {
	label: string;
	summary: ReactNode;
	children: ReactNode;
	className?: string;
	contentClassName?: string;
}) {
	const [open, setOpen] = useState(false);
	const openOnRelease = useRef(false);
	const panelId = useId();
	const triggerRef = useRef<HTMLButtonElement>(null);
	const [sideOffset, setSideOffset] = useState(FILTER_MENU_GAP);

	useLayoutEffect(() => {
		if (!open || !triggerRef.current) return;
		const trigger = triggerRef.current;
		const bar = trigger.closest("[data-filter-bar]");
		const updateOffset = () =>
			setSideOffset(
				FILTER_MENU_GAP + (bar ? bar.getBoundingClientRect().bottom - trigger.getBoundingClientRect().bottom : 0),
			);
		updateOffset();
		const observer = new ResizeObserver(updateOffset);
		observer.observe(trigger);
		if (bar) observer.observe(bar);
		return () => observer.disconnect();
	}, [open]);
	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger
				asChild
				// Radix opens on pointerdown; touch and pen wait for the tap's click so a scroll starting here is ignored.
				onPointerDown={(event) => {
					openOnRelease.current = event.pointerType !== "mouse" && !open;
					if (event.pointerType !== "mouse") event.preventDefault();
				}}
				onClick={() => {
					if (openOnRelease.current) setOpen(true);
					openOnRelease.current = false;
				}}
			>
				<FilterPanelButton
					ref={triggerRef}
					open={open}
					panelId={panelId}
					aria-label={label}
					className={cn("min-w-0", className)}
				>
					{summary}
					<ChevronDown className="size-3.5 shrink-0" aria-hidden />
				</FilterPanelButton>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				id={panelId}
				aria-label={label}
				align="start"
				sideOffset={sideOffset}
				className={cn(FILTER_MENU_SURFACE, "w-[340px] max-w-[calc(100vw-2rem)]", contentClassName)}
			>
				{children}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/** The entire row toggles its checkbox and keeps the menu open for more choices. */
export function FilterMultiSelectItem({
	className,
	onSelect,
	...props
}: ComponentProps<typeof DropdownMenuCheckboxItem>) {
	return (
		<DropdownMenuCheckboxItem
			{...props}
			className={cn(FILTER_MENU_ROW, "pl-7 [&>span:first-child]:left-1", className)}
			onSelect={(event) => {
				onSelect?.(event);
				event.preventDefault();
			}}
		/>
	);
}

/** Plain filter-menu action row; selecting again may reverse the active sort. */
export function FilterMenuItem({ className, onSelect, ...props }: ComponentProps<typeof DropdownMenuItem>) {
	return (
		<DropdownMenuItem
			{...props}
			className={cn(FILTER_MENU_ROW, className)}
			onSelect={(event) => {
				onSelect?.(event);
				event.preventDefault();
			}}
		/>
	);
}

"use client";

import {
	useCallback,
	useEffect,
	useId,
	useRef,
	useState,
	type FocusEvent,
	type KeyboardEvent,
	type PointerEvent,
	type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { autoUpdate, flip, offset, shift, size, useFloating, type Placement } from "@floating-ui/react-dom";
import { cn } from "@/lib/utils";
import { useAppPreferencesStore } from "@/lib/stores/useAppPreferencesStore";

/**
 * Hover/focus popover mechanics for short tooltips:
 * positioning, open/close delays, pointer travel into the card, Escape, one open
 * preview at a time, and touch suppression (taps keep normal link behavior).
 */
const OPEN_EVENT = "floating-preview-open";
const TOUCH_GRACE_MS = 800;
let lastTouchAt = 0;

export interface FloatingPreviewOptions {
	placement?: Placement;
	openDelay?: number;
	closeDelay?: number;
	disabled?: boolean;
}

export function useFloatingPreview({
	placement = "bottom-start",
	openDelay = 350,
	closeDelay = 140,
	disabled = false,
}: FloatingPreviewOptions = {}) {
	// The hover-card preference blocks hover/focus opening only; explicit `show` calls (clicks) still open.
	const hoverCards = useAppPreferencesStore((state) => state.hoverCards);
	const id = useId();
	const [open, setOpen] = useState(false);
	const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const { refs, floatingStyles } = useFloating({
		open,
		placement,
		strategy: "fixed",
		// Position with left/top: the enter animation's transform would otherwise override the placement.
		transform: false,
		whileElementsMounted: autoUpdate,
		middleware: [
			offset(8),
			flip({ padding: 8 }),
			shift({ padding: 8 }),
			size({
				padding: 8,
				apply({ availableHeight, elements }) {
					elements.floating.style.maxHeight = `${Math.max(160, availableHeight)}px`;
				},
			}),
		],
	});

	const clearTimers = useCallback(() => {
		if (openTimer.current) clearTimeout(openTimer.current);
		if (closeTimer.current) clearTimeout(closeTimer.current);
		openTimer.current = null;
		closeTimer.current = null;
	}, []);

	const show = useCallback(
		(delay: number) => {
			if (disabled) return;
			clearTimers();
			openTimer.current = setTimeout(() => {
				window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id }));
				setOpen(true);
			}, delay);
		},
		[clearTimers, disabled, id],
	);

	const hide = useCallback(
		(delay = closeDelay) => {
			clearTimers();
			if (delay <= 0) setOpen(false);
			else closeTimer.current = setTimeout(() => setOpen(false), delay);
		},
		[clearTimers, closeDelay],
	);

	useEffect(() => clearTimers, [clearTimers]);

	useEffect(() => {
		const onOtherOpen = (event: Event) => {
			if ((event as CustomEvent<string>).detail !== id) {
				clearTimers();
				setOpen(false);
			}
		};
		window.addEventListener(OPEN_EVENT, onOtherOpen);
		return () => window.removeEventListener(OPEN_EVENT, onOtherOpen);
	}, [clearTimers, id]);

	useEffect(() => {
		if (!open) return;
		const onKeyDown = (event: globalThis.KeyboardEvent) => {
			if (event.key === "Escape") hide(0);
		};
		const onScroll = () => hide(0);
		document.addEventListener("keydown", onKeyDown);
		window.addEventListener("scroll", onScroll, { capture: true, passive: true });
		return () => {
			document.removeEventListener("keydown", onKeyDown);
			window.removeEventListener("scroll", onScroll, { capture: true });
		};
	}, [hide, open]);

	const floatingId = `${id}-preview`;
	const triggerProps = {
		ref: refs.setReference,
		"aria-describedby": open ? floatingId : undefined,
		onPointerEnter: (event: PointerEvent<HTMLElement>) => {
			if (event.pointerType === "touch") {
				lastTouchAt = Date.now();
				return;
			}
			if (hoverCards) show(openDelay);
		},
		onPointerLeave: (event: PointerEvent<HTMLElement>) => {
			if (event.pointerType !== "touch") hide();
		},
		onPointerDown: (event: PointerEvent<HTMLElement>) => {
			if (event.pointerType === "touch") lastTouchAt = Date.now();
			// Clicking navigates; do not leave a card open over the destination.
			hide(0);
		},
		onFocus: (event: FocusEvent<HTMLElement>) => {
			if (Date.now() - lastTouchAt < TOUCH_GRACE_MS) return;
			if (hoverCards && event.currentTarget.matches(":focus-visible")) show(Math.min(openDelay, 200));
		},
		onBlur: () => hide(),
		onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
			if (event.key === "Escape" && open) {
				event.stopPropagation();
				hide(0);
			}
		},
	};

	const floatingProps = {
		ref: refs.setFloating,
		id: floatingId,
		style: floatingStyles,
		onPointerEnter: () => clearTimers(),
		onPointerLeave: () => hide(),
	};

	return { open, triggerProps, floatingProps, show, hide };
}

/** Portals the floating element when open. `className` styles the positioned container. */
export function FloatingPortal({
	open,
	floatingProps,
	className,
	role = "tooltip",
	children,
}: {
	open: boolean;
	floatingProps: ReturnType<typeof useFloatingPreview>["floatingProps"];
	className?: string;
	role?: "tooltip" | "group";
	children: ReactNode;
}) {
	if (!open || typeof document === "undefined") return null;
	return createPortal(
		<div
			{...floatingProps}
			role={role}
			className={cn(
				"z-[120] overflow-y-auto motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95",
				className,
			)}
		>
			{children}
		</div>,
		document.body,
	);
}

/** Short explanatory text on hover/focus. Rich cards use `HoverPreviewProvider`. */
export function Tooltip({
	content,
	children,
	placement = "top",
}: {
	content: ReactNode;
	placement?: Placement;
	children: (triggerProps: ReturnType<typeof useFloatingPreview>["triggerProps"]) => ReactNode;
}) {
	const preview = useFloatingPreview({ placement, openDelay: 200, closeDelay: 60 });
	return (
		<>
			{children(preview.triggerProps)}
			<FloatingPortal
				open={preview.open}
				floatingProps={preview.floatingProps}
				className="max-w-xs rounded-sm border border-highlight/15 bg-surface-raised px-2.5 py-1.5 text-xs text-foreground shadow-xl"
			>
				{content}
			</FloatingPortal>
		</>
	);
}

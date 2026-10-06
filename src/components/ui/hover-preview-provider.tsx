"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useAppPreferencesStore } from "@/lib/stores/useAppPreferencesStore";

interface HoverPreview {
	position: { left: number; placeAbove: boolean; verticalOffset: number };
	width: number;
	content: ReactNode;
}

interface HoverRequest extends HoverPreview {
	key: string;
	ready: boolean;
	minimumElapsed: boolean;
	loadTimer: ReturnType<typeof setTimeout> | null;
	showTimer: ReturnType<typeof setTimeout> | null;
}

interface ShowHoverPreview {
	key: string;
	content: ReactNode;
	clientX: number;
	clientY: number;
	width?: number;
	prepare?: () => Promise<unknown>;
}

interface HoverPreviewController {
	show: (options: ShowHoverPreview) => void;
	close: () => void;
	cancelClose: () => void;
	scheduleClose: () => void;
}

const HoverPreviewContext = createContext<HoverPreviewController | null>(null);

/** Cards show static details quickly; anything that reaches the API waits for sustained hover intent. */
export const HOVER_SHOW_DELAY_MS = 50;
export const HOVER_DATA_DELAY_MS = 300;

/**
 * True once the pointer has rested on the trigger for HOVER_DATA_DELAY_MS. Call inside preview
 * content, which mounts when the card shows; sweeping across links never reaches the API.
 */
export function useHoverDataIntent(): boolean {
	const [ready, setReady] = useState(false);
	useEffect(() => {
		const timer = setTimeout(() => setReady(true), HOVER_DATA_DELAY_MS - HOVER_SHOW_DELAY_MS);
		return () => clearTimeout(timer);
	}, []);
	return ready;
}

function positionPreview(
	clientX: number,
	clientY: number,
	requestedWidth: number,
): Pick<HoverPreview, "position" | "width"> {
	const gap = 12;
	const width = Math.min(requestedWidth, window.innerWidth - 16);
	const preferredLeft = clientX + gap + width <= window.innerWidth - 8 ? clientX + gap : clientX - width - gap;
	const placeAbove = clientY > window.innerHeight / 2;
	return {
		width,
		position: {
			left: Math.max(8, Math.min(preferredLeft, window.innerWidth - width - 8)),
			placeAbove,
			verticalOffset: placeAbove ? window.innerHeight - clientY + gap : clientY + gap,
		},
	};
}

/** Image failures leave the preview usable with its existing placeholder. */
export function preloadHoverImage(src?: string | null): Promise<void> {
	if (!src) return Promise.resolve();
	return new Promise((resolve) => {
		const image = new window.Image();
		image.onload = () => resolve();
		image.onerror = () => resolve();
		image.src = src;
		if (image.complete) resolve();
	});
}

export function HoverPreviewProvider({ children }: { children: ReactNode }) {
	const [activePreview, setActivePreview] = useState<HoverPreview | null>(null);
	const request = useRef<HoverRequest | null>(null);
	const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const touchInput = useRef(false);
	const hoverCards = useAppPreferencesStore((state) => state.hoverCards);
	const cancelClose = useCallback(() => {
		if (closeTimer.current) clearTimeout(closeTimer.current);
		closeTimer.current = null;
	}, []);
	const close = useCallback(() => {
		cancelClose();
		if (request.current?.loadTimer) clearTimeout(request.current.loadTimer);
		if (request.current?.showTimer) clearTimeout(request.current.showTimer);
		request.current = null;
		setActivePreview(null);
	}, [cancelClose]);
	const scheduleClose = useCallback(() => {
		cancelClose();
		if (request.current && !(request.current.ready && request.current.minimumElapsed)) {
			if (request.current.loadTimer) clearTimeout(request.current.loadTimer);
			if (request.current.showTimer) clearTimeout(request.current.showTimer);
			request.current = null;
			return;
		}
		closeTimer.current = setTimeout(() => {
			if (request.current?.loadTimer) clearTimeout(request.current.loadTimer);
			if (request.current?.showTimer) clearTimeout(request.current.showTimer);
			request.current = null;
			setActivePreview(null);
		}, 120);
	}, [cancelClose]);
	const show = useCallback(
		({ key, content, clientX, clientY, width = 320, prepare }: ShowHoverPreview) => {
			if (touchInput.current || !hoverCards) return;
			cancelClose();
			const placement = positionPreview(clientX, clientY, width);
			if (request.current?.key === key) {
				Object.assign(request.current, { ...placement, content });
				if (request.current.ready && request.current.minimumElapsed) setActivePreview({ ...placement, content });
				return;
			}
			if (request.current?.loadTimer) clearTimeout(request.current.loadTimer);
			if (request.current?.showTimer) clearTimeout(request.current.showTimer);
			setActivePreview(null);
			const next: HoverRequest = {
				key,
				content,
				...placement,
				ready: !prepare,
				minimumElapsed: false,
				loadTimer: null,
				showTimer: null,
			};
			request.current = next;
			const publish = () => {
				if (request.current === next && next.ready && next.minimumElapsed) {
					setActivePreview({ content: next.content, position: next.position, width: next.width });
				}
			};
			if (prepare) {
				next.loadTimer = setTimeout(() => {
					Promise.resolve()
						.then(prepare)
						.catch(() => undefined)
						.finally(() => {
							next.ready = true;
							publish();
						});
				}, HOVER_SHOW_DELAY_MS);
			}
			next.showTimer = setTimeout(() => {
				next.minimumElapsed = true;
				publish();
			}, HOVER_SHOW_DELAY_MS);
		},
		[cancelClose, hoverCards],
	);

	useEffect(() => close, [close]);
	useEffect(() => {
		const onPointer = (event: PointerEvent) => {
			touchInput.current = event.pointerType === "touch";
			if (touchInput.current) close();
		};
		const onKeyDown = () => {
			touchInput.current = false;
		};
		document.addEventListener("pointerdown", onPointer, { capture: true, passive: true });
		document.addEventListener("pointermove", onPointer, { capture: true, passive: true });
		document.addEventListener("keydown", onKeyDown, { capture: true });
		return () => {
			document.removeEventListener("pointerdown", onPointer, { capture: true });
			document.removeEventListener("pointermove", onPointer, { capture: true });
			document.removeEventListener("keydown", onKeyDown, { capture: true });
		};
	}, [close]);
	useEffect(() => {
		if (!activePreview) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") close();
		};
		const onScroll = () => close();
		document.addEventListener("keydown", onKeyDown);
		window.addEventListener("scroll", onScroll, { capture: true, passive: true });
		return () => {
			document.removeEventListener("keydown", onKeyDown);
			window.removeEventListener("scroll", onScroll, { capture: true });
		};
	}, [close, activePreview]);

	const controller = useMemo(
		() => ({ show, close, scheduleClose, cancelClose }),
		[show, close, scheduleClose, cancelClose],
	);
	return (
		<HoverPreviewContext.Provider value={controller}>
			{children}
			{activePreview &&
				hoverCards &&
				createPortal(
					<div
						className="pointer-events-none fixed z-[120] flex max-w-[calc(100vw-16px)] items-stretch gap-2 text-left"
						style={{
							left: activePreview.position.left,
							width: activePreview.width,
							...(activePreview.position.placeAbove
								? { bottom: activePreview.position.verticalOffset }
								: { top: activePreview.position.verticalOffset }),
						}}
						onMouseEnter={cancelClose}
						onMouseLeave={scheduleClose}
					>
						{activePreview.content}
					</div>,
					document.body,
				)}
		</HoverPreviewContext.Provider>
	);
}

export function useHoverPreview() {
	const controller = useContext(HoverPreviewContext);
	if (!controller) throw new Error("useHoverPreview must be used inside HoverPreviewProvider");
	return controller;
}

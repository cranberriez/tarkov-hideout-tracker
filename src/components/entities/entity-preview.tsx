"use client";

import { useId, type FocusEvent, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { useHoverPreview } from "@/components/ui/hover-preview-provider";
import { cn } from "@/lib/utils";

export type EntityTriggerProps = {
	onPointerEnter: (event: PointerEvent<HTMLElement>) => void;
	onPointerMove: (event: PointerEvent<HTMLElement>) => void;
	onPointerLeave: (event: PointerEvent<HTMLElement>) => void;
	onPointerDown: (event: PointerEvent<HTMLElement>) => void;
	onFocus: (event: FocusEvent<HTMLElement>) => void;
	onBlur: () => void;
	onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
};

/**
 * Rich hover/focus card around an entity link. The trigger stays a normal link
 * (click, middle-click, new tab); the card is informational and renders lazily.
 */
export function EntityPreview({
	renderPreview,
	prepare,
	disabled = false,
	className,
	children,
}: {
	renderPreview: () => ReactNode;
	prepare?: () => Promise<unknown>;
	disabled?: boolean;
	className?: string;
	children: (triggerProps: EntityTriggerProps) => ReactNode;
}) {
	const preview = useHoverPreview();
	const key = useId();
	const show = (clientX: number, clientY: number) =>
		preview.show({
			key,
			clientX,
			clientY,
			width: 280,
			prepare,
			content: (
				<div
					role="tooltip"
					className={cn(
						"pointer-events-auto max-h-[calc(100vh-16px)] w-full overflow-y-auto rounded-sm border border-highlight/15 bg-background/95 p-2 backdrop-blur-md shadow-[0_12px_35px_color-mix(in_oklab,_var(--shadow)_65%,_transparent)]",
						className,
					)}
				>
					{renderPreview()}
				</div>
			),
		});
	const triggerProps: EntityTriggerProps = {
		onPointerEnter: (event) => {
			if (event.pointerType === "touch") return;
			if (!disabled) show(event.clientX, event.clientY);
		},
		onPointerMove: (event) => {
			if (event.pointerType !== "touch" && !disabled) show(event.clientX, event.clientY);
		},
		onPointerLeave: (event) => {
			if (event.pointerType !== "touch") preview.scheduleClose();
		},
		onPointerDown: () => {
			preview.close();
		},
		onFocus: (event) => {
			if (disabled || !event.currentTarget.matches(":focus-visible")) return;
			const bounds = event.currentTarget.getBoundingClientRect();
			show(bounds.right, bounds.bottom);
		},
		onBlur: preview.scheduleClose,
		onKeyDown: (event) => {
			if (event.key === "Escape" || event.key === "Enter" || event.key === " ") preview.close();
		},
	};
	return children(triggerProps);
}

/** Label/value line inside a preview card. */
export function PreviewFact({ label, children }: { label: ReactNode; children: ReactNode }) {
	return (
		<div className="grid grid-cols-2 items-baseline gap-2 text-xs leading-4">
			<span className="text-foreground/75">{label}</span>
			<span className="min-w-0 text-left text-foreground">{children}</span>
		</div>
	);
}

/** Default text-link styling for entity names in running content. */
export const entityLinkClassName =
	"rounded-xs underline decoration-highlight/30 underline-offset-4 transition-colors hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

"use client";

import { useEffect, useId, useRef, type ComponentProps, type ReactNode } from "react";
import { Check, CircleDot, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function FilterBar({ className, ...props }: ComponentProps<"div">) {
	return <div className={cn("flex flex-wrap gap-1.5 rounded-md border bg-muted px-3 py-2", className)} {...props} />;
}

const buttonClass = (active: boolean) =>
	cn(
		"flex items-center justify-center gap-2 rounded-sm border px-3 py-2 text-xs font-medium transition-all focus-visible:outline-2 focus-visible:outline-brand",
		active
			? "border-brand bg-brand/10 text-brand"
			: "border-highlight/10 bg-shadow/20 text-muted-foreground hover:border-highlight/30 hover:bg-shadow/40",
	);

export function FilterToggle({
	checked,
	onCheckedChange,
	className,
	...props
}: Omit<ComponentProps<"button">, "onChange"> & {
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
}) {
	return (
		<button
			{...props}
			type="button"
			aria-pressed={checked}
			onClick={() => onCheckedChange(!checked)}
			className={cn(buttonClass(checked), className)}
		/>
	);
}

export function FilterPanelButton({
	open,
	panelId,
	className,
	...props
}: ComponentProps<"button"> & { open: boolean; panelId: string }) {
	return (
		<button
			{...props}
			type="button"
			aria-expanded={open}
			aria-controls={panelId}
			data-filter-panel-trigger={panelId}
			className={cn(buttonClass(open), className)}
		/>
	);
}

/** Place beside page content inside a relatively positioned container. */
export function FilterPanel({
	open,
	onOpenChange,
	className,
	...props
}: ComponentProps<"div"> & { open: boolean; onOpenChange?: (open: boolean) => void }) {
	const panelRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open || !onOpenChange) return;
		const closePanel = onOpenChange;

		function onPointerDown(event: PointerEvent) {
			const eventPath = event.composedPath();
			if (panelRef.current && eventPath.includes(panelRef.current)) return;

			const clickedTrigger = eventPath.some(
				(target) =>
					target instanceof HTMLElement && target.dataset.filterPanelTrigger === props.id,
			);
			if (!clickedTrigger) closePanel(false);
		}

		document.addEventListener("pointerdown", onPointerDown, true);
		return () => document.removeEventListener("pointerdown", onPointerDown, true);
	}, [open, onOpenChange, props.id]);

	return (
		<div
			{...props}
			ref={panelRef}
			aria-hidden={!open}
			inert={!open}
			className={cn(
				"absolute left-0 top-0 z-45 w-full max-w-[340px] origin-top-left transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none",
				open ? "pointer-events-auto scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0",
				className,
			)}
		/>
	);
}

export function FilterSearchInput({
	value,
	onValueChange,
	label,
	className,
	...props
}: Omit<ComponentProps<"input">, "value" | "onChange" | "size"> & {
	value: string;
	onValueChange: (value: string) => void;
	label: string;
}) {
	return (
		<div
			className={cn(
				"flex min-w-[140px] flex-1 items-center gap-2 rounded-sm border border-highlight/10 bg-shadow/40 px-3 focus-within:border-brand",
				className,
			)}
		>
			<Search size={14} className="shrink-0 text-subtle-foreground" aria-hidden="true" />
			<input
				{...props}
				type="search"
				aria-label={label}
				value={value}
				onChange={(event) => onValueChange(event.target.value)}
				className="min-w-0 flex-1 bg-transparent py-2 text-xs text-foreground outline-none placeholder:text-subtle-foreground [&::-webkit-search-cancel-button]:appearance-none"
			/>
			{value && (
				<button
					type="button"
					aria-label={`Clear ${label.toLowerCase()}`}
					onClick={() => onValueChange("")}
					className="text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand"
				>
					<X size={14} />
				</button>
			)}
		</div>
	);
}

/** Native radios supply single selection and keyboard arrow navigation. */
export function FilterRadioGroup<T extends string>({
	label,
	value,
	onValueChange,
	options,
	className,
}: {
	label: string;
	value: T;
	onValueChange: (value: T) => void;
	options: readonly { value: T; label: string; icon?: ReactNode }[];
	className?: string;
}) {
	const name = useId();
	return (
		<div
			role="radiogroup"
			aria-label={label}
			className={cn("flex rounded-sm border border-highlight/10 bg-shadow/40 p-1", className)}
		>
			{options.map((option) => (
				<label key={option.value} title={option.label} className="relative flex flex-1 cursor-pointer">
					<input
						type="radio"
						name={name}
						value={option.value}
						checked={value === option.value}
						onChange={() => onValueChange(option.value)}
						className="peer sr-only"
						aria-label={option.label}
					/>
					<span
						className={cn(
							"flex flex-1 items-center justify-center gap-1.5 rounded-xs px-2.5 py-1 text-xs font-medium transition-all peer-focus-visible:outline-2 peer-focus-visible:outline-brand",
							value === option.value
								? "bg-brand text-inverse shadow-sm"
								: "text-muted-foreground hover:bg-highlight/5 hover:text-foreground",
						)}
					>
						{option.icon ?? option.label}
					</span>
				</label>
			))}
		</div>
	);
}

export function FilterSection({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="space-y-3 py-1">
			<h3 className="text-[10px] font-bold uppercase tracking-wide text-subtle-foreground">{title}</h3>
			{children}
		</section>
	);
}

/** Divider heading inside a list-style selection panel. */
export function FilterGroupTitle({ children }: { children: ReactNode }) {
	return (
		<div className="border-y border-highlight/8 bg-highlight/[0.025] px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-subtle-foreground first:border-t-0">
			{children}
		</div>
	);
}

/** Multi-select option row with optional image, description, and count. */
export function FilterOptionRow({
	selected,
	onClick,
	image,
	icon,
	label,
	count,
	description,
}: {
	selected: boolean;
	onClick: () => void;
	image?: string | null;
	icon?: ReactNode;
	label: string;
	count?: number;
	description?: string;
}) {
	return (
		<button
			type="button"
			aria-pressed={selected}
			onClick={onClick}
			className={cn(
				"flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-highlight/5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand",
				selected && "bg-brand/8",
			)}
		>
			{image ? (
				// eslint-disable-next-line @next/next/no-img-element -- remote trader/map art is not optimized
				<img src={image} alt="" className="h-8 w-8 rounded-full object-cover grayscale-[20%]" />
			) : (
				<span className="flex h-8 w-8 items-center justify-center rounded-full bg-highlight/5 text-subtle-foreground">
					{icon ?? <CircleDot size={14} />}
				</span>
			)}
			<span className="min-w-0 flex-1">
				<span className="block truncate text-sm text-foreground">{label}</span>
				{description && <span className="block text-[10px] text-subtle-foreground">{description}</span>}
			</span>
			{count !== undefined && <span className="font-mono text-xs text-subtle-foreground">{count}</span>}
			<span
				className={cn(
					"flex h-4 w-4 items-center justify-center rounded-xs border",
					selected ? "border-brand bg-brand text-inverse" : "border-highlight/15",
				)}
			>
				{selected && <Check size={11} strokeWidth={3} />}
			</span>
		</button>
	);
}

/** Boolean preference row with a switch; `emphasized` marks warnings such as hidden quests. */
export function FilterSwitchRow({
	checked,
	onCheckedChange,
	label,
	description,
	emphasized = false,
}: {
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
	label: string;
	description?: string;
	emphasized?: boolean;
}) {
	return (
		<label
			className={cn(
				"flex cursor-pointer items-center justify-between gap-4 px-3 py-2.5 transition-colors hover:bg-highlight/5",
				emphasized && "border-y border-warning/20 bg-warning/[0.06] hover:bg-warning/[0.09]",
			)}
		>
			<span className="min-w-0">
				<span className={cn("block text-sm text-foreground", emphasized && "font-semibold text-warning")}>{label}</span>
				{description && <span className="block text-[10px] text-subtle-foreground">{description}</span>}
			</span>
			<input
				type="checkbox"
				role="switch"
				checked={checked}
				onChange={(event) => onCheckedChange(event.target.checked)}
				className="peer sr-only"
			/>
			<span
				aria-hidden="true"
				className="relative h-5 w-9 shrink-0 rounded-full bg-highlight/10 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-muted after:transition-transform peer-checked:bg-brand/25 peer-checked:after:translate-x-4 peer-checked:after:bg-brand peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-brand"
			/>
		</label>
	);
}

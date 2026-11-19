"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { autoUpdate, flip, offset, shift, size, useFloating } from "@floating-ui/react-dom";
import { Check, ChevronDown, Flag, PackageCheck, Star, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBattlePassData, useBattlePassSave } from "../BattlePassSeason";
import { useBattlePassPlanContext } from "../useBattlePassPlan";
import { Artwork } from "./ui/Artwork";
import { Segmented } from "./ui/Segmented";
import { flatField } from "./ui/field";

type Tab = "presets" | "goals";
const PRESETS = ["finish", "owned", "goals"] as const;

/** Destination selector: a trigger plus a popover with preset and goal tabs. */
export function DestinationPicker() {
	const { pages, tiles } = useBattlePassData();
	const { stored } = useBattlePassSave();
	const { selectedGoal, destinationIds, setDestination } = useBattlePassPlanContext();
	const id = useId();
	const [open, setOpen] = useState(false);
	const isPreset = (PRESETS as readonly string[]).includes(selectedGoal);
	const [tab, setTab] = useState<Tab>(isPreset ? "presets" : "goals");
	const panelRef = useRef<HTMLDivElement | null>(null);
	const triggerRef = useRef<HTMLButtonElement | null>(null);
	const { refs, floatingStyles } = useFloating({
		open,
		placement: "bottom-start",
		strategy: "fixed",
		whileElementsMounted: autoUpdate,
		middleware: [
			offset(6),
			flip({ padding: 8 }),
			shift({ padding: 8 }),
			size({
				padding: 8,
				apply({ availableHeight, elements }) {
					elements.floating.style.maxHeight = `${Math.max(220, Math.min(availableHeight, 520))}px`;
				},
			}),
		],
	});

	const goalCount = stored.goals.length;
	const reward = (rewardId: string) => {
		const tile = tiles.find((entry) => entry.id === rewardId);
		const page = pages.find((entry) => entry.cells.some((cell) => cell.id === rewardId));
		return { tile, page: page?.num };
	};
	const presets: {
		value: (typeof PRESETS)[number];
		label: string;
		description: string;
		icon: ReactNode;
		disabled?: boolean;
	}[] = [
		{
			value: "finish",
			label: "Finish the season",
			description: "Claim every reward on the final page, plus the pages needed to unlock it.",
			icon: <Flag className="size-4" aria-hidden />,
		},
		{
			value: "owned",
			label: "Most rewards with owned documents",
			description: "Claim as many rewards as the documents you already have allow.",
			icon: <PackageCheck className="size-4" aria-hidden />,
		},
		{
			value: "goals",
			label: "All saved goals",
			description: goalCount
				? `Reach all ${goalCount} ${goalCount === 1 ? "reward" : "rewards"} marked as goals.`
				: "Mark rewards as goals on the pass to use this.",
			icon: <Star className="size-4" aria-hidden />,
			disabled: goalCount === 0,
		},
	];
	const savedGoals = destinationIds.filter((rewardId) => stored.goals.includes(rewardId));
	const finalPage = destinationIds.filter((rewardId) => !stored.goals.includes(rewardId));

	const current = presets.find((preset) => preset.value === selectedGoal);
	const currentReward = current ? null : reward(selectedGoal);

	const choose = (value: string) => {
		setDestination(value);
		setOpen(false);
		triggerRef.current?.focus();
	};

	useEffect(() => {
		if (!open) return;
		const onPointerDown = (event: PointerEvent) => {
			const target = event.target as Node;
			if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
			setOpen(false);
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			setOpen(false);
			triggerRef.current?.focus();
		};
		document.addEventListener("pointerdown", onPointerDown);
		document.addEventListener("keydown", onKeyDown);
		// Move focus into the panel, onto the chosen option when it is in view.
		requestAnimationFrame(() => {
			const panel = panelRef.current;
			(
				panel?.querySelector<HTMLElement>('[aria-checked="true"]') ?? panel?.querySelector<HTMLElement>("button")
			)?.focus();
		});
		return () => {
			document.removeEventListener("pointerdown", onPointerDown);
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [open]);

	const option = (value: string, body: ReactNode, opts: { disabled?: boolean; leading: ReactNode }) => {
		const active = value === selectedGoal;
		return (
			<button
				key={value}
				type="button"
				role="radio"
				aria-checked={active}
				disabled={opts.disabled}
				onClick={() => choose(value)}
				className={cn(
					"flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-surface-raised focus-visible:bg-surface-raised focus-visible:outline-2 focus-visible:outline-brand disabled:pointer-events-none disabled:opacity-45",
					active && "bg-[color-mix(in_oklab,var(--brand)_6%,var(--surface-raised))]",
				)}
			>
				{opts.leading}
				<span className="min-w-0 flex-1">{body}</span>
				<Check className={cn("size-4 shrink-0 text-brand", !active && "invisible")} aria-hidden />
			</button>
		);
	};

	const goalOption = (rewardId: string) => {
		const { tile, page } = reward(rewardId);
		return option(
			rewardId,
			<>
				<span className={cn("block truncate font-medium", !tile && "text-warning")}>
					{tile?.displayName ?? "Unavailable goal"}
				</span>
				<span className="block text-xs text-muted-foreground">{tile ? `Page ${page}` : rewardId}</span>
			</>,
			{
				leading: (
					<span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-background/60">
						{tile ? (
							<Artwork src={tile.img} className="size-9" />
						) : (
							<TriangleAlert className="size-4 text-warning" aria-hidden />
						)}
					</span>
				),
			},
		);
	};

	return (
		<>
			<button
				ref={(node) => {
					triggerRef.current = node;
					refs.setReference(node);
				}}
				type="button"
				aria-haspopup="dialog"
				aria-expanded={open}
				aria-controls={open ? `${id}-panel` : undefined}
				aria-label={`Destination: ${current?.label ?? currentReward?.tile?.displayName ?? "Unavailable goal"}`}
				onClick={() => {
					if (!open) setTab(isPreset ? "presets" : "goals");
					setOpen(!open);
				}}
				className={cn(flatField, "flex w-full min-w-0 items-center gap-2 pl-2 text-left sm:w-80")}
			>
				<span className="flex size-6 shrink-0 items-center justify-center text-muted-foreground">
					{current ? (
						current.icon
					) : currentReward?.tile ? (
						<Artwork src={currentReward.tile.img} className="size-6" />
					) : (
						<TriangleAlert className="size-4 text-warning" aria-hidden />
					)}
				</span>
				<span className="min-w-0 flex-1 truncate">
					{current?.label ?? currentReward?.tile?.displayName ?? "Unavailable goal"}
				</span>
				{currentReward?.page && (
					<span className="shrink-0 text-xs text-muted-foreground">Page {currentReward.page}</span>
				)}
				<ChevronDown
					className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
					aria-hidden
				/>
			</button>
			{open &&
				createPortal(
					<div
						ref={(node) => {
							panelRef.current = node;
							refs.setFloating(node);
						}}
						id={`${id}-panel`}
						role="dialog"
						aria-label="Choose destination"
						style={floatingStyles}
						className="z-50 flex w-[min(24rem,calc(100vw-16px))] flex-col overflow-hidden rounded-lg border border-highlight/[0.06] bg-popover text-popover-foreground shadow-lg"
					>
						<div className="border-b border-highlight/[0.05] p-2">
							<Segmented<Tab>
								label="Destination type"
								value={tab}
								onChange={setTab}
								options={[
									{ value: "presets", label: "Presets" },
									{ value: "goals", label: `Goals${destinationIds.length ? ` (${destinationIds.length})` : ""}` },
								]}
							/>
						</div>
						<div
							role="radiogroup"
							aria-label={tab === "presets" ? "Presets" : "Goals"}
							className="min-h-0 overflow-y-auto p-1.5"
						>
							{tab === "presets" ? (
								presets.map((preset) =>
									option(
										preset.value,
										<>
											<span className="block font-medium">{preset.label}</span>
											<span className="block text-xs leading-relaxed text-muted-foreground">{preset.description}</span>
										</>,
										{
											disabled: preset.disabled,
											leading: (
												<span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-background/60 text-muted-foreground">
													{preset.icon}
												</span>
											),
										},
									),
								)
							) : (
								<>
									{savedGoals.length > 0 ? (
										<GroupLabel>Saved goals</GroupLabel>
									) : (
										<p className="px-2.5 py-2 text-xs text-muted-foreground">
											No saved goals yet. Mark rewards as goals on the pass to pick them here.
										</p>
									)}
									{savedGoals.map(goalOption)}
									{finalPage.length > 0 && <GroupLabel>Final page</GroupLabel>}
									{finalPage.map(goalOption)}
								</>
							)}
						</div>
					</div>,
					document.body,
				)}
		</>
	);
}

function GroupLabel({ children }: { children: ReactNode }) {
	return (
		<p className="px-2.5 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{children}</p>
	);
}

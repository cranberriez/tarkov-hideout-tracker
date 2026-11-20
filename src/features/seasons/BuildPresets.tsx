"use client";

import { useState, type ReactNode } from "react";
import { Bookmark, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { matchingSlot, parsePresets, PRESET_NAME_MAX, serializePresets, type PresetSlots } from "./modifiers/presets";
import { useModifierBuilder } from "./ModifierBuilder";

/** Global, profile-independent named builds per season; not in backups or resets (like saved picks). */
const presetsKey = (seasonId: string) => `tarkov-season-presets-${seasonId}-v1`;

function readPresets(seasonId: string, knownIds: readonly string[]): PresetSlots {
	try {
		return parsePresets(localStorage.getItem(presetsKey(seasonId)), knownIds);
	} catch {
		return parsePresets(null, knownIds);
	}
}

/** False when browser storage is unavailable or full. */
function writePresets(seasonId: string, slots: PresetSlots): boolean {
	try {
		localStorage.setItem(presetsKey(seasonId), serializePresets(slots));
		return true;
	} catch {
		return false;
	}
}

/** Only ever called from event handlers (saving a slot), never during render. */
const now = () => Date.now();

type Pending = { slot: number; action: "save" | "overwrite" | "load" | "delete" };

const SMALL_BUTTON =
	"inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-50";
const NEUTRAL = "bg-surface-raised hover:bg-surface-raised/70";
const PRIMARY = "bg-foreground text-background hover:bg-foreground/85";
const DANGER = "bg-danger/18 text-foreground hover:bg-danger/28";

/** "Presets" bar button: ten named slots to save, overwrite, load or delete builds. */
export function BuildPresetsButton() {
	const builder = useModifierBuilder();
	const [open, setOpen] = useState(false);
	const [slots, setSlots] = useState<PresetSlots>([]);
	const [pending, setPending] = useState<Pending | null>(null);
	const [name, setName] = useState("");
	const [error, setError] = useState<string | null>(null);
	if (!builder) return null;
	const { seasonId, modifiers, selection } = builder;
	const knownIds = modifiers.map((modifier) => modifier.id);
	const kinds = Object.fromEntries(modifiers.map((modifier) => [modifier.id, modifier.kind]));
	const current = matchingSlot(slots, selection.selected);
	const hasPicks = selection.selected.size > 0;

	const openChange = (next: boolean) => {
		if (next) setSlots(readPresets(seasonId, knownIds));
		setPending(null);
		setError(null);
		setOpen(next);
	};
	const persist = (next: PresetSlots) => {
		if (!writePresets(seasonId, next)) {
			setError("Couldn't save: browser storage is unavailable or full.");
			return;
		}
		setSlots(next);
		setPending(null);
		setError(null);
	};
	const update = (slot: number, value: PresetSlots[number]) =>
		persist(slots.map((entry, index) => (index === slot ? value : entry)));
	const saveCurrent = (slot: number, presetName: string) =>
		update(slot, { name: presetName, picks: knownIds.filter((id) => selection.selected.has(id)), savedAt: now() });
	const load = (slot: number) => {
		selection.load(slots[slot]!.picks);
		openChange(false);
	};
	// Only an unsaved, non-empty build needs a warning before it's replaced.
	const requestLoad = (slot: number) =>
		hasPicks && current === -1 ? setPending({ slot, action: "load" }) : load(slot);
	const startSave = (slot: number) => {
		setName("");
		setPending({ slot, action: "save" });
	};

	return (
		<Dialog open={open} onOpenChange={openChange}>
			<DialogTrigger asChild>
				<button type="button" className={cn(SMALL_BUTTON, NEUTRAL)}>
					<Bookmark aria-hidden className="size-3.5" />
					Presets
				</button>
			</DialogTrigger>
			<DialogContent className="max-h-[calc(100dvh-2rem)] max-w-lg overflow-y-auto p-5">
				<DialogTitle className="text-base font-semibold">Build presets</DialogTitle>
				<DialogDescription className="text-sm text-muted-foreground">
					Save your current build to a slot, or load one. Saved in this browser only.
				</DialogDescription>
				{error && <p className="mt-3 rounded-md bg-danger/18 px-3 py-2 text-sm">{error}</p>}
				<ol className="mt-4 space-y-2">
					{slots.map((slot, index) => {
						const active = pending?.slot === index ? pending.action : null;
						if (slot === null && active !== "save")
							return (
								<li key={index}>
									<button
										type="button"
										disabled={!hasPicks}
										onClick={() => startSave(index)}
										aria-label={`Save current build to slot ${index + 1}`}
										title={hasPicks ? undefined : "Pick modifiers to save a build"}
										className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-dashed border-border text-xs font-semibold uppercase tracking-widest text-muted-foreground transition-colors enabled:hover:bg-foreground/10 enabled:hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
									>
										<Plus aria-hidden className="size-4" />
										Empty
									</button>
								</li>
							);
						return (
							<li key={index} className="space-y-2 rounded-md bg-surface-raised/50 px-3 py-2">
								<div className="flex min-h-8 flex-wrap items-center gap-x-3 gap-y-2">
									<span className="w-5 shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
										{index + 1}
									</span>
									{slot === null ? (
										<form
											className="flex min-w-0 flex-1 items-center gap-2"
											onSubmit={(event) => {
												event.preventDefault();
												if (name.trim()) saveCurrent(index, name.trim());
											}}
										>
											<input
												autoFocus
												value={name}
												maxLength={PRESET_NAME_MAX}
												onChange={(event) => setName(event.target.value)}
												onKeyDown={(event) => {
													// Escape cancels naming instead of closing the dialog.
													if (event.key === "Escape") {
														event.stopPropagation();
														setPending(null);
													}
												}}
												placeholder="Preset name"
												aria-label={`Name for slot ${index + 1}`}
												className="min-w-0 flex-1 rounded-md bg-card px-2.5 py-1 text-sm outline-none ring-1 ring-border focus:ring-foreground"
											/>
											<button type="submit" disabled={!name.trim()} className={cn(SMALL_BUTTON, PRIMARY)}>
												Save
											</button>
											<button type="button" onClick={() => setPending(null)} className={cn(SMALL_BUTTON, NEUTRAL)}>
												Cancel
											</button>
										</form>
									) : (
										<>
											<div className="min-w-0 flex-1">
												<p className="flex items-center gap-2 text-sm font-semibold">
													<span className="truncate">{slot.name}</span>
													{index === current && (
														<span className="shrink-0 rounded-full bg-success/18 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
															Current
														</span>
													)}
												</p>
												<PickCounts picks={slot.picks} kinds={kinds} />
											</div>
											{!active && (
												<div className="flex basis-full items-center justify-end gap-2 sm:basis-auto">
													<button
														type="button"
														disabled={index === current}
														onClick={() => requestLoad(index)}
														className={cn(SMALL_BUTTON, PRIMARY)}
													>
														Load
													</button>
													<button
														type="button"
														disabled={!hasPicks || index === current}
														onClick={() => setPending({ slot: index, action: "overwrite" })}
														className={cn(SMALL_BUTTON, NEUTRAL)}
													>
														Overwrite
													</button>
													<button
														type="button"
														aria-label={`Delete ${slot.name}`}
														onClick={() => setPending({ slot: index, action: "delete" })}
														className={cn(SMALL_BUTTON, NEUTRAL, "px-1.5")}
													>
														<Trash2 aria-hidden className="size-3.5" />
													</button>
												</div>
											)}
										</>
									)}
								</div>
								{/* Confirmations get their own row so the preset's details keep their space. */}
								{slot && active && active !== "save" && (
									<Confirm
										message={CONFIRM_MESSAGES[active]}
										confirmLabel={CONFIRM_LABELS[active]}
										danger={active !== "overwrite"}
										onConfirm={() =>
											active === "load"
												? load(index)
												: active === "delete"
													? update(index, null)
													: saveCurrent(index, slot.name)
										}
										onCancel={() => setPending(null)}
									/>
								)}
							</li>
						);
					})}
				</ol>
			</DialogContent>
		</Dialog>
	);
}

/** Positive count in green, negative count in red. */
function PickCounts({ picks, kinds }: { picks: string[]; kinds: Record<string, string> }) {
	const positive = picks.filter((id) => kinds[id] === "positive").length;
	const negative = picks.filter((id) => kinds[id] === "negative").length;
	return (
		<p className="flex items-center gap-3 text-xs font-semibold tabular-nums">
			<span className="text-success">{positive} positive</span>
			<span className="text-danger">{negative} negative</span>
		</p>
	);
}

const CONFIRM_MESSAGES = {
	save: "",
	overwrite: "Replace with your current build?",
	load: "Your current build isn't saved and will be lost.",
	delete: "Delete this preset?",
} as const;
const CONFIRM_LABELS = { save: "", overwrite: "Overwrite", load: "Load anyway", delete: "Delete" } as const;

function Confirm({
	message,
	confirmLabel,
	danger,
	onConfirm,
	onCancel,
}: {
	message: ReactNode;
	confirmLabel: string;
	danger: boolean;
	onConfirm: () => void;
	onCancel: () => void;
}) {
	return (
		<div role="alert" className="flex flex-wrap items-center justify-end gap-2 border-t border-border/60 pt-2">
			<span className="mr-auto text-xs text-foreground/85">{message}</span>
			<div className="flex shrink-0 items-center gap-2">
				<button type="button" autoFocus onClick={onConfirm} className={cn(SMALL_BUTTON, danger ? DANGER : PRIMARY)}>
					{confirmLabel}
				</button>
				<button type="button" onClick={onCancel} className={cn(SMALL_BUTTON, NEUTRAL)}>
					Cancel
				</button>
			</div>
		</div>
	);
}

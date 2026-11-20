"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useBattlePassData } from "../BattlePassSeason";
import { documentDisplayName } from "../lib/battle-pass-display";
import {
	mapExcludedTypes,
	type FewestTypesInput,
	type FewestTypesResult,
	type GatheringPreview,
} from "../lib/map-filter-model";
import { useBattlePassPlanContext } from "../useBattlePassPlan";
import { Artwork } from "./ui/Artwork";
import { DocumentIcon } from "./ui/DocumentIcon";
import { liftedControl, syncValue } from "./ui/field";

const usd = (cents: number) =>
	new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const days = (count: number) => `${count} ${count === 1 ? "day" : "days"}`;
/** Cash differences up to this many cents read as the same cost. */
const SAME_COST_CENTS = 10;

/** Same map selection, ignoring order; null means every map. */
const sameMaps = (a: readonly string[] | null, b: readonly string[] | null) =>
	a === b || (!!a && !!b && a.length === b.length && a.every((map) => b.includes(map)));

type PresetResult = { result: { maps: string[]; preview: GatheringPreview } } | { error: string };

/** Fewest document types at the same cost, searched in a worker whenever its input changes. */
function useFewestTypes(input: FewestTypesInput | null) {
	const [found, setFound] = useState<{ input: FewestTypesInput; result: FewestTypesResult } | null>(null);
	useEffect(() => {
		if (!input) return;
		const worker = new Worker(new URL("../lib/map-preset.worker.ts", import.meta.url), { type: "module" });
		worker.onmessage = (event: MessageEvent<{ result: FewestTypesResult } | { error: string }>) => {
			if ("result" in event.data) setFound({ input, result: event.data.result });
			worker.terminate();
		};
		worker.onerror = () => worker.terminate();
		worker.postMessage({ kind: "types", input });
		return () => worker.terminate();
	}, [input]);
	return found && found.input === input ? found.result : null;
}

/** Choose the maps to farm; document types no chosen map spawns are bought as classified. */
export function GatheringMapsPicker() {
	const { documents, mapNames, mapOrder, mapThumbnails } = useBattlePassData();
	const { settings, mapTarget, previewMaps, fewestMapsInput, fewestTypesInput, gathering, route } =
		useBattlePassPlanContext();
	const simplest = useFewestTypes(fewestTypesInput);
	// Documents of each type the route still misses after owned inventory.
	const needed = useMemo(() => {
		const totals: Record<string, number> = {};
		for (const claim of route?.claims ?? [])
			for (const [key, cost] of Object.entries(claim.cost))
				totals[key] = (totals[key] ?? 0) + Math.max(0, cost - (claim.ordinaryUsed[key] ?? 0));
		return totals;
	}, [route]);
	const applied = settings.gatheringMaps;

	// Draft follows the applied value until the player edits it.
	const [draft, setDraft] = useState(applied);
	const [base, setBase] = useState(applied);
	if (!sameMaps(base, applied)) {
		setBase(applied);
		if (sameMaps(draft, base)) setDraft(applied);
	}
	const dirty = !sameMaps(draft, applied);

	const normalize = (maps: string[]) => {
		const ordered = mapOrder.filter((map) => maps.includes(map));
		return ordered.length === mapOrder.length ? null : ordered;
	};
	const chosen = draft ?? mapOrder;
	const toggle = (map: string) =>
		setDraft(normalize(chosen.includes(map) ? chosen.filter((entry) => entry !== map) : [...chosen, map]));

	// "Fewest maps" search, off the page thread.
	const worker = useRef<Worker | null>(null);
	const [searching, setSearching] = useState(false);
	const [searchError, setSearchError] = useState<string | null>(null);
	useEffect(() => () => worker.current?.terminate(), []);
	const findFewest = () => {
		if (!fewestMapsInput) return;
		worker.current?.terminate();
		const next = new Worker(new URL("../lib/map-preset.worker.ts", import.meta.url), { type: "module" });
		worker.current = next;
		const finish = () => {
			next.terminate();
			if (worker.current === next) worker.current = null;
			setSearching(false);
		};
		next.onmessage = (event: MessageEvent<PresetResult>) => {
			finish();
			if ("error" in event.data) setSearchError(event.data.error);
			else setDraft(normalize(event.data.result.maps));
		};
		next.onerror = () => {
			finish();
			setSearchError("Could not search map sets. Try again.");
		};
		setSearching(true);
		setSearchError(null);
		next.postMessage({ kind: "maps", input: fewestMapsInput });
	};

	const comparing = dirty && mapTarget > 0 && chosen.length > 0;
	const appliedPreview = useMemo(() => (comparing ? previewMaps(applied) : null), [comparing, previewMaps, applied]);
	const draftPreview = useMemo(() => (comparing ? previewMaps(draft) : null), [comparing, previewMaps, draft]);

	const name = (key: string) => documentDisplayName(documents.find((doc) => doc.key === key)?.name ?? key);
	const empty = chosen.length === 0;
	// Types the draft leaves out, for the comparison's tooltip.
	const excluded = dirty && !empty ? mapExcludedTypes(draft, mapNames).map(name) : [];

	return (
		<section
			data-syncing={gathering.stale || gathering.calculating || undefined}
			className="group/sync w-full space-y-3"
		>
			<h5
				className="text-sm font-semibold"
				title="Document types that spawn on none of the chosen maps are bought as classified instead."
			>
				Maps to farm
			</h5>
			<div
				className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6"
				role="group"
				aria-label="Maps to farm"
			>
				{mapOrder.map((map) => {
					const on = chosen.includes(map);
					const spawns = documents.filter((doc) => mapNames[doc.key]?.includes(map));
					// A type spawning on several maps counts on each of them.
					const need = spawns.reduce((sum, doc) => sum + (needed[doc.key] ?? 0), 0);
					return (
						<button
							key={map}
							type="button"
							aria-pressed={on}
							onClick={() => toggle(map)}
							className={cn(
								"flex min-w-0 items-center gap-2.5 rounded-lg p-2 text-left text-xs transition-colors focus-visible:outline-2 focus-visible:outline-brand",
								on
									? cn(liftedControl, "text-foreground")
									: "border border-transparent bg-transparent text-muted-foreground opacity-60 hover:opacity-90",
							)}
						>
							<Artwork
								src={mapThumbnails[map.toLowerCase().replaceAll(" ", "-")] ?? ""}
								className={cn("size-9 shrink-0 rounded-md object-cover sm:size-11", !on && "grayscale")}
							/>
							<span className="min-w-0 space-y-1">
								<span className="line-clamp-2 block text-sm leading-tight font-medium" title={map}>
									{map}
								</span>
								{spawns.length > 0 && (
									<span className="flex items-center gap-0.5">
										{spawns.map((doc) => (
											<DocumentIcon key={doc.key} documentKey={doc.key} className={cn("size-6", !on && "grayscale")} />
										))}
										{route && (
											<span
												className={cn(
													"ml-1 text-sm font-semibold tabular-nums",
													need ? "text-foreground" : "text-muted-foreground",
												)}
												title={`${need} documents still needed from the types on ${map}`}
											>
												{need}
											</span>
										)}
									</span>
								)}
							</span>
						</button>
					);
				})}
			</div>
			<div className="flex flex-wrap items-center gap-x-2 gap-y-2">
				<Button size="xs" variant="ghost" disabled={draft === null} onClick={() => setDraft(null)}>
					All maps
				</Button>
				<Button size="xs" variant="ghost" disabled={empty} onClick={() => setDraft([])}>
					Clear
				</Button>
				<Button
					size="xs"
					variant="ghost"
					disabled={!fewestMapsInput || mapTarget === 0 || searching}
					title={mapTarget === 0 ? "Pick a gathering target first" : undefined}
					onClick={findFewest}
				>
					{searching && <LoaderCircle className="size-3.5 animate-spin" aria-hidden />}
					{searching ? "Searching…" : "Fewest maps, same cost"}
				</Button>
				{simplest && fewestTypesInput && simplest.types.length < simplest.gatheredTypes.length && (
					<Button
						size="xs"
						variant="ghost"
						title={`Gather only ${simplest.types.map(name).join(", ")}. Turns off ${simplest.excluded.map(name).join(", ")} in every mode.`}
						onClick={() => settings.excludeGatheringTypes(fewestTypesInput.profileKeys, simplest.excluded)}
					>
						Simplest: {simplest.types.length} document {simplest.types.length === 1 ? "type" : "types"}, same cost
						<span className="flex items-center">
							{simplest.types.map((key) => (
								<DocumentIcon key={key} documentKey={key} className="size-4" />
							))}
						</span>
					</Button>
				)}
				{searchError ? (
					<span className="text-xs text-warning">{searchError}</span>
				) : empty ? (
					<span role="status" className="text-xs text-warning">
						Pick at least one map.
					</span>
				) : (
					comparing && (
						<Comparison before={appliedPreview} after={draftPreview} target={mapTarget} excluded={excluded} />
					)
				)}
				{dirty && (
					<span className="ml-auto flex items-center gap-2">
						<Button size="sm" onClick={() => setDraft(applied)}>
							Reset
						</Button>
						<Button
							tone="brand"
							variant="solid"
							size="sm"
							disabled={empty}
							onClick={() => settings.setGatheringMaps(draft)}
						>
							Apply maps
						</Button>
					</span>
				)}
			</div>
		</section>
	);
}

/** One-line price change of the draft maps against the applied ones. */
function Comparison({
	before,
	after,
	target,
	excluded,
}: {
	before: GatheringPreview | null;
	after: GatheringPreview | null;
	target: number;
	excluded: string[];
}) {
	if (!before || !after) return null;
	const delta = after.cashCents - before.cashCents;
	const same = Math.abs(delta) <= SAME_COST_CENTS && after.gathered === before.gathered;
	const worse = !same && (delta > SAME_COST_CENTS || after.gathered < before.gathered);
	const cost = same
		? "Same cost"
		: Math.abs(delta) <= SAME_COST_CENTS
			? "Same cash"
			: `${delta > 0 ? "+" : "−"}${usd(Math.abs(delta))}`;
	return (
		<p
			role="status"
			title={excluded.length ? `Bought as classified: ${excluded.join(", ")}` : undefined}
			className={cn(
				"rounded-md px-2 py-1 text-xs tabular-nums",
				syncValue,
				worse ? "bg-warning/[0.07] text-warning" : "bg-success/[0.07] text-success",
			)}
		>
			<span className="font-semibold">{cost}</span> · {after.gathered}/{target} docs · {days(after.days)}
			{after.days !== before.days && <> (was {before.days})</>}
		</p>
	);
}

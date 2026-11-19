"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useBattlePassData } from "../BattlePassSeason";
import { documentDisplayName } from "../lib/battle-pass-display";
import { mapExcludedTypes, type GatheringPreview } from "../lib/map-filter-model";
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

/** Choose the maps to farm; document types no chosen map spawns are bought as classified. */
export function GatheringMapsPicker() {
	const { documents, mapNames, mapOrder, mapThumbnails } = useBattlePassData();
	const { settings, mapExcluded, mapTarget, previewMaps, fewestMapsInput, gathering } = useBattlePassPlanContext();
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
		next.postMessage(fewestMapsInput);
	};

	const appliedPreview = useMemo(
		() => (dirty && mapTarget > 0 ? previewMaps(applied) : null),
		[dirty, mapTarget, previewMaps, applied],
	);
	const draftPreview = useMemo(
		() => (dirty && mapTarget > 0 ? previewMaps(draft) : null),
		[dirty, mapTarget, previewMaps, draft],
	);

	const name = (key: string) => documentDisplayName(documents.find((doc) => doc.key === key)?.name ?? key);
	// While editing, show what the draft would exclude; otherwise what the applied maps exclude.
	const excluded = dirty ? mapExcludedTypes(draft, mapNames) : mapExcluded;
	const restricted = dirty ? draft !== null : applied !== null;

	return (
		<section
			data-syncing={gathering.stale || gathering.calculating || undefined}
			className="group/sync w-full space-y-3"
		>
			<div className="space-y-1">
				<h4 className="text-sm font-semibold">Maps to farm</h4>
				<p className="text-xs leading-relaxed text-muted-foreground">
					Pick the maps you want to farm. Document types that spawn on none of them are bought as classified instead.
				</p>
			</div>
			<div className="flex flex-wrap gap-2" role="group" aria-label="Maps to farm">
				{mapOrder.map((map) => {
					const on = chosen.includes(map);
					const last = on && chosen.length === 1;
					const spawns = documents.filter((doc) => mapNames[doc.key]?.includes(map));
					return (
						<button
							key={map}
							type="button"
							aria-pressed={on}
							disabled={last}
							title={last ? "Keep at least one map" : undefined}
							onClick={() => toggle(map)}
							className={cn(
								"inline-flex h-9 max-w-full items-center gap-1.5 rounded-md px-2 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-brand disabled:cursor-not-allowed",
								on
									? cn(liftedControl, "text-foreground")
									: "border border-transparent bg-transparent text-muted-foreground opacity-60 hover:opacity-90",
							)}
						>
							<Artwork
								src={mapThumbnails[map.toLowerCase().replaceAll(" ", "-")] ?? ""}
								className={cn("size-6 shrink-0 rounded object-cover", !on && "grayscale")}
							/>
							<span className="truncate font-medium">{map}</span>
							{spawns.length > 0 && (
								<span className="flex shrink-0 items-center" aria-hidden>
									{spawns.map((doc) => (
										<DocumentIcon key={doc.key} documentKey={doc.key} className={cn("size-4", !on && "grayscale")} />
									))}
								</span>
							)}
						</button>
					);
				})}
			</div>
			<div className="flex flex-wrap items-center gap-1">
				<Button size="xs" variant="ghost" disabled={draft === null} onClick={() => setDraft(null)}>
					All maps
				</Button>
				<Button
					size="xs"
					variant="ghost"
					disabled={!fewestMapsInput || mapTarget === 0 || searching}
					onClick={findFewest}
				>
					{searching && <LoaderCircle className="size-3.5 animate-spin" aria-hidden />}
					{searching ? "Searching…" : "Fewest maps, same cost"}
				</Button>
				{searchError && <span className="text-xs text-warning">{searchError}</span>}
			</div>
			{restricted && excluded.length > 0 && (
				<p className="text-xs text-muted-foreground">
					Not on {dirty ? "these" : "your"} maps, bought as classified:{" "}
					<span className="text-foreground/80">{excluded.map(name).join(", ")}</span>
				</p>
			)}
			{dirty &&
				(mapTarget === 0 ? (
					<p className="text-xs text-muted-foreground">Pick a gathering target to see how maps change the cost.</p>
				) : (
					<Comparison before={appliedPreview} after={draftPreview} target={mapTarget} />
				))}
			{dirty && (
				<div className="flex flex-wrap items-center gap-2">
					<Button tone="brand" variant="solid" size="sm" onClick={() => settings.setGatheringMaps(draft)}>
						Apply maps
					</Button>
					<Button size="sm" onClick={() => setDraft(applied)}>
						Reset
					</Button>
				</div>
			)}
		</section>
	);
}

/** One-line price change of the draft maps against the applied ones. */
function Comparison({
	before,
	after,
	target,
}: {
	before: GatheringPreview | null;
	after: GatheringPreview | null;
	target: number;
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
			className={cn(
				"w-fit rounded-md px-2.5 py-1.5 text-xs tabular-nums",
				syncValue,
				worse ? "bg-warning/[0.07] text-warning" : "bg-success/[0.07] text-success",
			)}
		>
			<span className="font-semibold">{cost}</span> · gathers {after.gathered} of {target} · {days(after.days)}
			{after.days !== before.days && <> (was {before.days})</>}
		</p>
	);
}

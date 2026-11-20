import Image from "next/image";
import { ArrowUpRight, Users } from "lucide-react";
import { SEASONS, type SeasonId } from "@/lib/cfg/seasons";
import { cn } from "@/lib/utils";
import { ModifierBuilderBar, ModifierBuilderProvider, SelectableCard } from "./ModifierBuilder";
import { ChangeChip, ChangeRow } from "./SeasonChanges";
import {
	SEASON_MODIFIERS,
	formatPoints,
	modifiersOfKind,
	mostPicked,
	previousVersion,
	type ModifierKind,
	type SeasonModifier,
} from "./modifiers";

/** Card tint 12% and chip tint 18% are tuned so foreground text stays at WCAG AAA in every theme. */
const TONES: Record<ModifierKind, { band: string; card: string; accent: string }> = {
	global: { band: "via-surface-raised", card: "bg-card", accent: "bg-surface-raised text-foreground" },
	positive: {
		band: "via-success/20",
		card: "bg-linear-to-r from-success/12 to-card to-70%",
		accent: "bg-success/18 text-foreground",
	},
	negative: {
		band: "via-danger/20",
		card: "bg-linear-to-r from-danger/12 to-card to-70%",
		accent: "bg-danger/18 text-foreground",
	},
};

const seasonShort = (id: SeasonId) => `S${SEASONS.findIndex((season) => season.id === id) + 1}`;
const percent = (value: number) => `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
const pointsLabel = (points: number) =>
	`${points < 0 ? "Costs" : "Grants"} ${Math.abs(points)} ${Math.abs(points) === 1 ? "point" : "points"}`;

function Chip({ className, label, children }: { className: string; label?: string; children: React.ReactNode }) {
	return (
		<span
			aria-label={label}
			className={cn(
				"rounded-full px-2 py-0.5 text-xs font-semibold normal-case tracking-normal tabular-nums",
				className,
			)}
		>
			{children}
		</span>
	);
}

function ModifierIcon({ modifier, size }: { modifier: SeasonModifier; size: number }) {
	if (!modifier.icon)
		return (
			<span aria-hidden className="shrink-0 rounded-md bg-surface-raised/40" style={{ width: size, height: size }} />
		);
	return (
		<Image
			src={modifier.icon}
			alt=""
			width={size}
			height={size}
			unoptimized
			className="shrink-0 opacity-90"
			style={{ width: size, height: size }}
		/>
	);
}

function PickRate({ value }: { value: number }) {
	const text = `Picked by ${percent(value)} of players`;
	return (
		<span
			title={text}
			aria-label={text}
			className="inline-flex items-center gap-1 rounded-full bg-surface-raised px-2 py-0.5 text-xs font-semibold tabular-nums"
		>
			<Users aria-hidden className="size-3 text-muted-foreground" />
			{percent(value)}
		</span>
	);
}

/**
 * Personal modifiers only, shown while "See changes" is on: "New", or one combined
 * "S1: was −3, 25% fracture chance" chip. Nothing when the previous season's version matches.
 */
function HistoryChip({ seasonId, modifier }: { seasonId: SeasonId; modifier: SeasonModifier }) {
	if (modifier.kind === "global" || SEASONS[0].id === seasonId) return null;
	const previous = previousVersion(seasonId, modifier);
	if (!previous) {
		return (
			<ChangeRow>
				<ChangeChip className="bg-new-badge text-new-badge-foreground">New</ChangeChip>
			</ChangeRow>
		);
	}
	const was = [
		previous.pointsChanged && previous.modifier.points !== undefined ? formatPoints(previous.modifier.points) : null,
		modifier.previousNote ?? previous.oldStat,
	].filter(Boolean);
	if (was.length === 0) return null;
	return (
		<ChangeRow>
			<ChangeChip className="bg-surface-raised text-muted-foreground">
				{seasonShort(previous.seasonId)}: was {was.join(", ")}
			</ChangeChip>
		</ChangeRow>
	);
}

function ModifierCard({ seasonId, modifier }: { seasonId: SeasonId; modifier: SeasonModifier }) {
	const tone = TONES[modifier.kind];
	const content = (
		<>
			<div className="flex gap-3">
				<ModifierIcon modifier={modifier} size={48} />
				<div className="min-w-0 flex-1 space-y-1">
					<div className="flex items-start gap-2">
						<h3 className="min-w-0 flex-1 pt-1 text-sm font-semibold uppercase tracking-wide">{modifier.name}</h3>
						{(modifier.pickRate !== undefined || modifier.points !== undefined) && (
							<div className="flex shrink-0 items-center gap-1.5">
								{modifier.pickRate !== undefined && <PickRate value={modifier.pickRate} />}
								{modifier.points !== undefined && (
									<Chip className={cn("px-2.5 text-sm", tone.accent)} label={pointsLabel(modifier.points)}>
										{formatPoints(modifier.points)}
									</Chip>
								)}
							</div>
						)}
					</div>
					{/* foreground/85 over the 12% tint keeps descriptions at WCAG AAA (≥ 7:1) in every theme. */}
					<ul className="list-disc space-y-0.5 pl-4 text-sm leading-5 text-foreground/85">
						{modifier.effects.map((effect) => (
							<li key={effect}>{effect}</li>
						))}
					</ul>
				</div>
			</div>
			{/* Fixed-height footer for extra info, actions and icons; only rendered while it has content. */}
			<HistoryChip seasonId={seasonId} modifier={modifier} />
		</>
	);
	if (modifier.kind === "global") return <li className={cn("flex flex-col rounded-lg p-3", tone.card)}>{content}</li>;
	return (
		<SelectableCard id={modifier.id} name={modifier.name} kind={modifier.kind} className={tone.card}>
			{content}
		</SelectableCard>
	);
}

const SECTION_TITLES: Record<ModifierKind, string> = {
	global: "Global modifiers",
	positive: "Personal positive",
	negative: "Personal negative",
};

function ModifierSection({ seasonId, kind }: { seasonId: SeasonId; kind: ModifierKind }) {
	const modifiers = modifiersOfKind(SEASON_MODIFIERS[seasonId], kind);
	const values = modifiers.map((modifier) => Math.abs(modifier.points ?? 0));
	const range = `${Math.min(...values)}–${Math.max(...values)} points`;
	const caption =
		kind === "global"
			? "Always active for every player"
			: `${modifiers.length} modifiers · each ${kind === "positive" ? "costs" : "grants"} ${range}`;
	return (
		<section aria-labelledby={`${kind}-modifiers-heading`} className="space-y-3">
			<div className={cn("bg-linear-to-r from-transparent to-transparent py-2 text-center", TONES[kind].band)}>
				<h2 id={`${kind}-modifiers-heading`} className="text-lg font-bold uppercase tracking-[0.22em]">
					{SECTION_TITLES[kind]}
				</h2>
				<p className="text-xs text-muted-foreground">{caption}</p>
			</div>
			<ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
				{modifiers.map((modifier) => (
					<ModifierCard key={modifier.id} seasonId={seasonId} modifier={modifier} />
				))}
			</ul>
		</section>
	);
}

/** Published pick rates as tiles, positives over negatives, like Battlestate's recap image. */
export function MostPicked({ seasonId, title }: { seasonId: SeasonId; title: string }) {
	const set = SEASON_MODIFIERS[seasonId];
	const rows = (["positive", "negative"] as const).map((kind) => ({ kind, modifiers: mostPicked(set, kind) }));
	if (rows.every((row) => row.modifiers.length === 0)) return null;
	return (
		<section aria-labelledby={`${seasonId}-most-picked`} className="space-y-3">
			<div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
				<h2 id={`${seasonId}-most-picked`} className="text-lg font-bold uppercase tracking-[0.22em]">
					{title}
				</h2>
				{set.pickRateSource && (
					<a
						href={set.pickRateSource}
						target="_blank"
						rel="noreferrer"
						className="inline-flex items-center gap-1 text-sm text-info hover:underline"
					>
						Source
						<ArrowUpRight aria-hidden className="size-3.5" />
					</a>
				)}
			</div>
			{rows.map(({ kind, modifiers }) => (
				<ol
					key={kind}
					aria-label={`Most picked ${kind} modifiers`}
					className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
				>
					{modifiers.map((modifier, index) => (
						<li
							key={modifier.id}
							className={cn("relative flex items-center justify-center gap-3 rounded-lg px-3 py-5", TONES[kind].card)}
						>
							<span className="absolute left-3 top-2 text-xs font-semibold text-muted-foreground tabular-nums">
								#{index + 1}
							</span>
							<ModifierIcon modifier={modifier} size={56} />
							<div className="min-w-0 space-y-1">
								<p className="text-sm font-semibold uppercase leading-tight tracking-wide">{modifier.name}</p>
								<Chip className={TONES[kind].accent} label={`Picked by ${percent(modifier.pickRate!)} of players`}>
									{percent(modifier.pickRate!)}
								</Chip>
							</div>
						</li>
					))}
				</ol>
			))}
		</section>
	);
}

/** Static modifier list for one season. No data connections. */
export function SeasonModifiers({ seasonId }: { seasonId: SeasonId }) {
	const set = SEASON_MODIFIERS[seasonId];
	const points = Object.fromEntries(
		set.modifiers.flatMap((modifier) => (modifier.points === undefined ? [] : [[modifier.id, modifier.points]])),
	);
	return (
		<div className="space-y-8">
			<ModifierSection seasonId={seasonId} kind="global" />
			<ModifierBuilderProvider points={points}>
				<ModifierBuilderBar />
				<ModifierSection seasonId={seasonId} kind="positive" />
				<ModifierSection seasonId={seasonId} kind="negative" />
			</ModifierBuilderProvider>
			<p className="rounded-lg bg-card px-4 py-3 text-sm text-muted-foreground">
				{set.note} You start with 0 points: negatives grant points that positives spend. Source:{" "}
				{set.source.url ? (
					<a href={set.source.url} target="_blank" rel="noreferrer" className="underline hover:text-foreground">
						{set.source.label}
					</a>
				) : (
					set.source.label
				)}
				.
			</p>
		</div>
	);
}

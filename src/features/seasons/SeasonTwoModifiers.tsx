import Image from "next/image";
import { cn } from "@/lib/utils";
import {
	SEASON_2_GLOBAL_MODIFIERS,
	SEASON_2_MODIFIER_NOTE,
	SEASON_2_NEGATIVE_MODIFIERS,
	SEASON_2_POSITIVE_MODIFIERS,
	season2ModifierIcon,
	type Season2Modifier,
	type Season2PersonalModifier,
} from "./season-2-modifiers";

type Tone = "global" | "positive" | "negative";

const TONES: Record<Tone, { band: string; card: string; points: string }> = {
	global: {
		band: "via-surface-raised",
		card: "bg-card",
		points: "",
	},
	positive: {
		band: "via-success/20",
		card: "bg-linear-to-r from-success/12 to-card to-70%",
		points: "bg-success/15 text-success",
	},
	negative: {
		band: "via-danger/20",
		card: "bg-linear-to-r from-danger/12 to-card to-70%",
		points: "bg-danger/15 text-danger",
	},
};

/** Poster sign convention with a typographic minus: positives cost (−n), negatives grant (+n). */
const formatPoints = (points: number) => (points < 0 ? `−${-points}` : `+${points}`);

function pointsRange(modifiers: Season2PersonalModifier[]) {
	const values = modifiers.map((modifier) => Math.abs(modifier.points));
	return `${Math.min(...values)}–${Math.max(...values)} points`;
}

function ModifierCard({ modifier, tone }: { modifier: Season2Modifier | Season2PersonalModifier; tone: Tone }) {
	const points = "points" in modifier ? modifier.points : null;
	return (
		<li className={cn("flex gap-3 rounded-lg p-3", TONES[tone].card)}>
			<Image
				src={season2ModifierIcon(modifier.id)}
				alt=""
				width={48}
				height={48}
				unoptimized
				className="size-12 shrink-0 opacity-90"
			/>
			<div className="min-w-0 space-y-1">
				<h3 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold uppercase tracking-wide">
					{modifier.name}
					{points !== null && (
						<span
							className={cn("rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums", TONES[tone].points)}
							aria-label={`${points < 0 ? "Costs" : "Grants"} ${Math.abs(points)} ${Math.abs(points) === 1 ? "point" : "points"}`}
						>
							{formatPoints(points)}
						</span>
					)}
				</h3>
				<ul className="list-disc space-y-0.5 pl-4 text-sm leading-5 text-muted-foreground">
					{modifier.effects.map((effect) => (
						<li key={effect}>{effect}</li>
					))}
				</ul>
			</div>
		</li>
	);
}

function ModifierSection({
	id,
	title,
	caption,
	tone,
	modifiers,
}: {
	id: string;
	title: string;
	caption: string;
	tone: Tone;
	modifiers: (Season2Modifier | Season2PersonalModifier)[];
}) {
	return (
		<section aria-labelledby={`${id}-heading`} className="space-y-3">
			<div className={cn("bg-linear-to-r from-transparent to-transparent py-2 text-center", TONES[tone].band)}>
				<h2 id={`${id}-heading`} className="text-lg font-bold uppercase tracking-[0.22em]">
					{title}
				</h2>
				<p className="text-xs text-muted-foreground">{caption}</p>
			</div>
			<ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
				{modifiers.map((modifier) => (
					<ModifierCard key={modifier.id} modifier={modifier} tone={tone} />
				))}
			</ul>
		</section>
	);
}

/** Static replica of the Season 2 modifier poster. No data connections. */
export function SeasonTwoModifiers() {
	return (
		<div className="space-y-8">
			<ModifierSection
				id="global-modifiers"
				title="Global modifiers"
				caption="Always active for every player"
				tone="global"
				modifiers={SEASON_2_GLOBAL_MODIFIERS}
			/>
			<ModifierSection
				id="positive-modifiers"
				title="Personal positive"
				caption={`${SEASON_2_POSITIVE_MODIFIERS.length} modifiers · each costs ${pointsRange(SEASON_2_POSITIVE_MODIFIERS)}`}
				tone="positive"
				modifiers={SEASON_2_POSITIVE_MODIFIERS}
			/>
			<ModifierSection
				id="negative-modifiers"
				title="Personal negative"
				caption={`${SEASON_2_NEGATIVE_MODIFIERS.length} modifiers · each grants ${pointsRange(SEASON_2_NEGATIVE_MODIFIERS)}`}
				tone="negative"
				modifiers={SEASON_2_NEGATIVE_MODIFIERS}
			/>
			<p className="rounded-lg bg-card px-4 py-3 text-sm text-muted-foreground">
				{SEASON_2_MODIFIER_NOTE} You start with 0 points: negatives grant points that positives spend.
			</p>
		</div>
	);
}

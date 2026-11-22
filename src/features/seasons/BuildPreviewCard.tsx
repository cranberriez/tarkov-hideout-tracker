/**
 * Link-preview card for a season build, rendered by `next/og` (satori). Satori supports only inline
 * styles and flexbox, and every element with several children needs `display: flex`.
 *
 * Mirrors the in-app screenshot sheet: season title with the site link top-right, then the picked
 * positives and negatives side by side (a lone side takes the full width), each headed by its total,
 * as tinted cards with icon, name and points chip. Effect text is left out: platforms show the card
 * at about a third of its size (Discord: ~400px wide), where it would be unreadable. Cards grow to
 * fill the canvas and gain columns when picks are many. Icons arrive as PNG data URIs (satori cannot
 * decode WebP).
 */
import type { SeasonId } from "@/lib/cfg/seasons";
import { SITE_URL } from "@/lib/seo";
import type { BuilderTotals } from "./modifiers/builder";
import { formatPoints } from "./modifiers/types";
import { PREVIEW_FORMATS, PREVIEW_THEMES, type PreviewFormat } from "./share-preview";

export type PreviewModifier = { id: string; kind: "positive" | "negative"; name: string; points: number };
type Kind = PreviewModifier["kind"];

/** Hex copies of the default theme's tokens (the image renderer can't read CSS). */
const CARD = "#0e0e10"; // --card-bg
const BORDER = "#292929"; // --border
const INK = "#e5e5e5"; // --foreground
const MUTED = "rgba(229, 229, 229, 0.85)"; // foreground/85
const TONES = {
	// heading: --success / --danger; chip: --modifier-picked-*; tint: MODIFIER_CARD_TINT (chroma ×0.6 at
	// 12%) pre-blended onto CARD, since satori's gradients don't fade translucent stops smoothly.
	positive: { heading: "#4ade80", chip: "#7bd594", tint: "#1d2621" },
	negative: { heading: "#f87171", chip: "#e77b79", tint: "#271c1d" },
} as const;

const PADDING = 40;
const HEADER = 76;
const HEADER_GAP = 24;
const HEADING = 40;
const HEADING_GAP = 12;
const SECTION_GAP = 28;
const CARD_GAP = 10;
const MAX_CARD_HEIGHT = 150;
const MAX_ICON = 80;
const CARD_INNER_GAP = 14;

type Section = { kind: Kind; picks: PreviewModifier[]; total: string };
type Layout = { columns: number; cardWidth: number; cardHeight: number };

/** Padding, icon, chip and remaining name width for a card of the given size. */
function cardMetrics(cardWidth: number, cardHeight: number) {
	const padding = Math.max(8, Math.round(cardHeight * 0.14));
	const iconSize = Math.min(MAX_ICON, cardHeight - padding * 2);
	const chipFont = Math.max(18, Math.min(30, Math.round(cardHeight * 0.3)));
	const chipWidth = Math.round(chipFont * 2.4);
	const nameWidth = cardWidth - padding * 2 - iconSize - chipWidth - CARD_INNER_GAP * 2;
	return { padding, iconSize, chipFont, nameWidth };
}

/**
 * Columns per section and card size so every pick fits. Scores each option by its weaker dimension
 * (card height vs. room for the name), so cards neither shrink to slivers nor squeeze names out.
 */
function fitLayout(sections: Section[], bodyWidth: number, bodyHeight: number): Layout {
	const sectionWidth = (bodyWidth - (sections.length - 1) * SECTION_GAP) / sections.length;
	const available = bodyHeight - HEADING - HEADING_GAP;
	const most = Math.max(...sections.map((section) => section.picks.length));
	let best: Layout & { score: number } = { columns: 1, cardWidth: 0, cardHeight: 0, score: -Infinity };
	for (let columns = sections.length === 1 ? 2 : 1; columns <= 4; columns++) {
		const rows = Math.ceil(most / columns);
		const cardWidth = Math.floor((sectionWidth - (columns - 1) * CARD_GAP) / columns);
		const cardHeight = Math.min(MAX_CARD_HEIGHT, Math.floor((available - (rows - 1) * CARD_GAP) / rows));
		const score = Math.min(cardHeight, cardMetrics(cardWidth, cardHeight).nameWidth / 3.5);
		if (score > best.score) best = { columns, cardWidth, cardHeight, score };
	}
	return best;
}

/** Rough uppercase glyph width in em for the bundled font; only used to pick a font size. */
const GLYPH_EM = 0.68;

/** Lines a greedy word wrap needs for `text` at `font` px within `width`. */
function wrappedLines(text: string, font: number, width: number): number {
	const perLine = Math.max(1, Math.floor(width / (font * GLYPH_EM)));
	let lines = 1;
	let used = 0;
	for (const word of text.split(" ")) {
		if (word.length > perLine) return Infinity;
		const next = used === 0 ? word.length : used + 1 + word.length;
		if (next <= perLine) used = next;
		else {
			lines++;
			used = word.length;
		}
	}
	return lines;
}

/** The largest name size (down to 16px) whose wrap fits the card's height, at most two lines. */
function nameFont(name: string, width: number, height: number): number {
	const preferred = Math.max(18, Math.min(32, Math.round(height * 0.32)));
	for (let font = preferred; font > 16; font -= 2) {
		const lines = wrappedLines(name.toUpperCase(), font, width);
		if (lines <= 2 && lines * font * 1.1 <= height - 16) return font;
	}
	return 16;
}

function Header({ seasonId }: { seasonId: SeasonId }) {
	const theme = PREVIEW_THEMES[seasonId];
	return (
		<div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", height: HEADER }}>
			<div style={{ display: "flex", alignItems: "center", gap: 18 }}>
				<div
					style={{
						display: "flex",
						padding: "6px 12px",
						borderRadius: 6,
						background: theme.accent,
						color: theme.surface,
						fontSize: 26,
						letterSpacing: 4,
						textTransform: "uppercase",
					}}
				>
					{theme.chipLabel}
				</div>
				<div style={{ display: "flex", gap: 16, fontSize: 58, lineHeight: 1 }}>
					<span>{theme.first}</span>
					<span style={{ color: theme.accent }}>{theme.second}</span>
				</div>
			</div>
			<span style={{ fontSize: 26, color: MUTED }}>
				{new URL(SITE_URL).host}/{seasonId}
			</span>
		</div>
	);
}

function Frame({ seasonId, format, children }: { seasonId: SeasonId; format: PreviewFormat; children: React.ReactNode }) {
	const size = PREVIEW_FORMATS[format];
	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				width: size.width,
				height: size.height,
				padding: PADDING,
				background: CARD,
				border: `2px solid ${BORDER}`,
				color: INK,
			}}
		>
			<Header seasonId={seasonId} />
			{children}
		</div>
	);
}

function Card({ modifier, icon, layout }: { modifier: PreviewModifier; icon?: string; layout: Layout }) {
	const { cardWidth, cardHeight } = layout;
	const { padding, iconSize, chipFont, nameWidth } = cardMetrics(cardWidth, cardHeight);
	const font = nameFont(modifier.name, nameWidth, cardHeight);
	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				gap: CARD_INNER_GAP,
				flexShrink: 0,
				width: cardWidth,
				height: cardHeight,
				padding,
				borderRadius: 10,
				backgroundImage: `linear-gradient(90deg, ${TONES[modifier.kind].tint} 0%, ${CARD} 70%, ${CARD} 100%)`,
			}}
		>
			{icon ? (
				// eslint-disable-next-line @next/next/no-img-element -- satori renders plain <img>
				<img src={icon} width={iconSize} height={iconSize} alt="" style={{ opacity: 0.9 }} />
			) : (
				<div style={{ display: "flex", width: iconSize, height: iconSize }} />
			)}
			<span
				style={{
					display: "block",
					flex: 1,
					fontSize: font,
					lineHeight: 1.1,
					letterSpacing: 1,
					textTransform: "uppercase",
					lineClamp: 2,
					overflow: "hidden",
				}}
			>
				{modifier.name}
			</span>
			<span
				style={{
					display: "flex",
					alignSelf: "flex-start",
					padding: `2px ${Math.round(chipFont / 2.5)}px`,
					borderRadius: 999,
					fontSize: chipFont,
					lineHeight: 1.2,
					background: TONES[modifier.kind].chip,
					color: "#000000",
				}}
			>
				{formatPoints(modifier.points)}
			</span>
		</div>
	);
}

export function BuildPreviewCard({
	seasonId,
	format,
	modifiers,
	totals,
	icons,
}: {
	seasonId: SeasonId;
	format: PreviewFormat;
	/** Selected modifiers, positives first. */
	modifiers: PreviewModifier[];
	totals: BuilderTotals;
	/** Modifier ID → PNG data URI. */
	icons: Map<string, string>;
}) {
	const size = PREVIEW_FORMATS[format];
	const bodyWidth = size.width - PADDING * 2;
	const bodyHeight = size.height - PADDING * 2 - HEADER - HEADER_GAP;
	const sections: Section[] = (["positive", "negative"] as const)
		.map((kind) => ({
			kind,
			picks: modifiers.filter((modifier) => modifier.kind === kind),
			total: kind === "positive" ? `−${totals.spent}` : `+${totals.granted}`,
		}))
		.filter((section) => section.picks.length > 0);
	const layout = fitLayout(sections, bodyWidth, bodyHeight);
	return (
		<Frame seasonId={seasonId} format={format}>
			<div style={{ display: "flex", gap: SECTION_GAP, marginTop: HEADER_GAP, height: bodyHeight }}>
				{sections.map(({ kind, picks, total }) => (
					<div key={kind} style={{ display: "flex", flexDirection: "column", flex: 1, gap: HEADING_GAP }}>
						<div style={{ display: "flex", alignItems: "baseline", gap: 14, height: HEADING }}>
							<span style={{ fontSize: 26, letterSpacing: 6, color: MUTED }}>
								{kind === "positive" ? "POSITIVE" : "NEGATIVE"}
							</span>
							<span style={{ fontSize: 32, color: TONES[kind].heading }}>{total}</span>
						</div>
						{/* Exactly `columns` wide, so satori wraps cards into the fitted grid. */}
						<div
							style={{
								display: "flex",
								flexWrap: "wrap",
								alignContent: "flex-start",
								gap: CARD_GAP,
								// +2px slack: yoga rounding must not push the last column onto its own row.
								width: layout.columns * layout.cardWidth + (layout.columns - 1) * CARD_GAP + 2,
							}}
						>
							{picks.map((modifier) => (
								<Card key={modifier.id} modifier={modifier} icon={icons.get(modifier.id)} layout={layout} />
							))}
						</div>
					</div>
				))}
			</div>
		</Frame>
	);
}

/** The build-less card: season title and a pitch for the builder. */
export function GenericPreviewCard({
	seasonId,
	format,
	modifierCount,
}: {
	seasonId: SeasonId;
	format: PreviewFormat;
	modifierCount: number;
}) {
	return (
		<Frame seasonId={seasonId} format={format}>
			<div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, gap: 28 }}>
				<span style={{ fontSize: 84, lineHeight: 1.05 }}>Plan your build</span>
				<span style={{ fontSize: 40, lineHeight: 1.2, color: MUTED }}>
					All {modifierCount} modifiers · point budget · share it with one link
				</span>
			</div>
		</Frame>
	);
}

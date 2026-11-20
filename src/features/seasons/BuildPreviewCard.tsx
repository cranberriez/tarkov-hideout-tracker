/**
 * Link-preview card for a season build, rendered by `next/og` (satori). Satori supports only inline
 * styles and flexbox, and every element with several children needs `display: flex`.
 *
 * Platforms show the card at about a third of its size (Discord: ~400px wide), so everything is sized
 * for that shrink: nothing under ~26px, one large Net figure, and an icon-first grid that grows to fill
 * the canvas. Few picks get named tiles; many picks switch to icons only (names are in the embed text).
 * Only selected modifiers are shown; icons arrive as PNG data URIs (satori cannot decode WebP).
 */
import type { SeasonId } from "@/lib/cfg/seasons";
import type { BuilderTotals } from "./modifiers/builder";
import { formatPoints } from "./modifiers/types";
import { PREVIEW_FORMATS, PREVIEW_THEMES, type PreviewFormat } from "./share-preview";

export type PreviewModifier = { id: string; kind: "positive" | "negative"; name: string; points: number };

const INK = "#e9e7e1";
const MUTED = "rgba(233, 231, 225, 0.7)";
// Hex approximations of --success / --danger (oklch tokens).
const TONES = {
	positive: { chip: "#4ade80", tile: "rgba(74, 222, 128, 0.14)" },
	negative: { chip: "#f87171", tile: "rgba(248, 113, 113, 0.14)" },
} as const;

const PADDING = 40;
const HEADER = 116;
const HEADER_GAP = 22;
const MAX_TILE_WIDTH = 380;
/** Below this, names would be unreadable after the platform's shrink, so tiles show icons only. */
const NAMED_MIN = { width: 150, height: 150 };

type Grid = { columns: number; width: number; height: number; gap: number; named: boolean };

/** The column count that gives the largest tiles while every pick fits the body. */
function fitGrid(count: number, bodyWidth: number, bodyHeight: number): Grid {
	const gap = count > 20 ? 8 : 14;
	let best: Grid & { score: number } = { columns: 1, width: 0, height: 0, gap, named: false, score: -1 };
	for (let columns = 1; columns <= count; columns++) {
		const rows = Math.ceil(count / columns);
		const width = Math.min(MAX_TILE_WIDTH, Math.floor((bodyWidth - (columns - 1) * gap) / columns));
		const available = Math.floor((bodyHeight - (rows - 1) * gap) / rows);
		const height = Math.min(available, Math.round(width * 1.1));
		const score = Math.min(width, available);
		if (score > best.score) {
			const named = width >= NAMED_MIN.width && height >= NAMED_MIN.height;
			best = { columns, width, height, gap, named, score };
		}
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

/** The largest name size (26–40px, down to 20px for long names) that keeps every word whole in two lines. */
function nameFont(name: string, width: number): number {
	const preferred = Math.max(26, Math.min(40, Math.round(width * 0.14)));
	for (let font = preferred; font > 20; font -= 2) {
		if (wrappedLines(name.toUpperCase(), font, width) <= 2) return font;
	}
	return 20;
}

function Header({ seasonId, totals }: { seasonId: SeasonId; totals?: BuilderTotals }) {
	const theme = PREVIEW_THEMES[seasonId];
	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				height: HEADER,
				paddingBottom: 16,
				borderBottom: "2px solid rgba(233, 231, 225, 0.14)",
			}}
		>
			<div style={{ display: "flex", alignItems: "center", gap: 20 }}>
				<div
					style={{
						display: "flex",
						padding: "8px 14px",
						borderRadius: 6,
						background: theme.accent,
						color: theme.surface,
						fontSize: 28,
						letterSpacing: 4,
						textTransform: "uppercase",
					}}
				>
					{theme.chipLabel}
				</div>
				<div style={{ display: "flex", gap: 18, fontSize: 70, lineHeight: 1 }}>
					<span>{theme.first}</span>
					<span style={{ color: theme.accent }}>{theme.second}</span>
				</div>
			</div>
			{totals && (
				<div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
					<span style={{ fontSize: 30, letterSpacing: 3, color: MUTED }}>NET</span>
					<span
						style={{
							fontSize: 72,
							lineHeight: 1,
							color: totals.valid ? TONES.positive.chip : TONES.negative.chip,
						}}
					>
						{totals.balance === 0 ? "0" : formatPoints(totals.balance)}
					</span>
				</div>
			)}
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
				background: PREVIEW_THEMES[seasonId].surface,
				color: INK,
			}}
		>
			{children}
		</div>
	);
}

function Tile({ modifier, icon, grid }: { modifier: PreviewModifier; icon?: string; grid: Grid }) {
	const side = Math.min(grid.width, grid.height);
	const font = nameFont(modifier.name, grid.width - 20);
	const nameBlock = grid.named ? Math.round(font * 1.1 * 2) + 10 : 0;
	const iconSize = Math.max(
		24,
		Math.round(grid.named ? Math.min(grid.width * 0.6, grid.height - nameBlock - 28) : side * 0.74),
	);
	const chipFont = Math.max(22, Math.min(36, Math.round(side * 0.16)));
	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				gap: 8,
				position: "relative",
				width: grid.width,
				height: grid.height,
				borderRadius: 10,
				background: TONES[modifier.kind].tile,
			}}
		>
			{icon ? (
				// eslint-disable-next-line @next/next/no-img-element -- satori renders plain <img>
				<img src={icon} width={iconSize} height={iconSize} alt="" />
			) : (
				<div style={{ display: "flex", width: iconSize, height: iconSize }} />
			)}
			{grid.named && (
				<span
					style={{
						display: "block",
						maxWidth: grid.width - 16,
						fontSize: font,
						lineHeight: 1.1,
						textAlign: "center",
						textTransform: "uppercase",
						lineClamp: 2,
						overflow: "hidden",
					}}
				>
					{modifier.name}
				</span>
			)}
			<span
				style={{
					position: "absolute",
					top: 6,
					right: 6,
					padding: `0 ${Math.round(chipFont / 3)}px`,
					borderRadius: 999,
					fontSize: chipFont,
					lineHeight: 1.25,
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
	const grid = fitGrid(modifiers.length, bodyWidth, bodyHeight);
	return (
		<Frame seasonId={seasonId} format={format}>
			<Header seasonId={seasonId} totals={totals} />
			<div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginTop: HEADER_GAP, height: bodyHeight }}>
				{/* Exactly `columns` wide, so wrapping matches the fitted grid. */}
				<div
					style={{
						display: "flex",
						flexWrap: "wrap",
						justifyContent: "center",
						gap: grid.gap,
						width: grid.columns * grid.width + (grid.columns - 1) * grid.gap,
					}}
				>
					{modifiers.map((modifier) => (
						<Tile key={modifier.id} modifier={modifier} icon={icons.get(modifier.id)} grid={grid} />
					))}
				</div>
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
			<Header seasonId={seasonId} />
			<div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, gap: 28 }}>
				<span style={{ fontSize: 84, lineHeight: 1.05 }}>Plan your build</span>
				<span style={{ fontSize: 40, lineHeight: 1.2, color: MUTED }}>
					All {modifierCount} modifiers · point budget · share it with one link
				</span>
			</div>
		</Frame>
	);
}

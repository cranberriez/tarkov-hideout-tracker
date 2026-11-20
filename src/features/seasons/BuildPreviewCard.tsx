/**
 * Link-preview card (1200×630) for a season build, rendered by `next/og` (satori). Satori supports
 * only inline styles and flexbox, and every element with several children needs `display: flex`.
 * Only selected modifiers are shown; icons arrive as PNG data URIs (satori cannot decode WebP).
 */
import type { SeasonId } from "@/lib/cfg/seasons";
import type { BuilderTotals } from "./modifiers/builder";
import { formatPoints } from "./modifiers/types";
import { PREVIEW_IMAGE_SIZE, PREVIEW_THEMES } from "./share-preview";

export type PreviewModifier = { id: string; name: string; points: number; icon?: string };

const INK = "#e9e7e1";
const MUTED = "rgba(233, 231, 225, 0.72)";
// Hex approximations of --success / --danger (oklch tokens).
const TONES = {
	positive: { chip: "#4ade80", tile: "rgba(74, 222, 128, 0.16)" },
	negative: { chip: "#f87171", tile: "rgba(248, 113, 113, 0.16)" },
} as const;

const PADDING = 44;
const HEADER = 96;
const SECTION_LABEL = 24;
const SECTION_GAP = 14;

/** Densest-last tile layouts; the first whose rows fit the body is used. */
const DENSITIES = [
	{ columns: 3, row: 88, icon: 60, font: 28, chip: 26, gap: 10 },
	{ columns: 3, row: 64, icon: 44, font: 23, chip: 22, gap: 8 },
	{ columns: 4, row: 50, icon: 34, font: 18, chip: 18, gap: 6 },
	{ columns: 5, row: 40, icon: 28, font: 15, chip: 15, gap: 5 },
	{ columns: 6, row: 31, icon: 22, font: 12, chip: 12, gap: 4 },
] as const;
type Density = (typeof DENSITIES)[number];

function pickDensity(sectionSizes: number[]): Density {
	const body = PREVIEW_IMAGE_SIZE.height - PADDING * 2 - HEADER;
	const sections = sectionSizes.filter((size) => size > 0);
	for (const density of DENSITIES) {
		const height = sections.reduce((total, size) => {
			const rows = Math.ceil(size / density.columns);
			return total + SECTION_LABEL + rows * density.row + (rows - 1) * density.gap;
		}, SECTION_GAP * Math.max(0, sections.length - 1));
		if (height <= body) return density;
	}
	return DENSITIES[DENSITIES.length - 1];
}

function Frame({ seasonId, children, right }: { seasonId: SeasonId; children: React.ReactNode; right: React.ReactNode }) {
	const theme = PREVIEW_THEMES[seasonId];
	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				width: "100%",
				height: "100%",
				padding: PADDING,
				background: theme.surface,
				color: INK,
			}}
		>
			<div
				style={{
					display: "flex",
					alignItems: "flex-end",
					justifyContent: "space-between",
					height: HEADER - 18,
					paddingBottom: 14,
					marginBottom: 18,
					borderBottom: `2px solid rgba(233, 231, 225, 0.14)`,
				}}
			>
				<div style={{ display: "flex", alignItems: "center", gap: 18 }}>
					<div
						style={{
							display: "flex",
							padding: "6px 12px",
							borderRadius: 4,
							background: theme.accent,
							color: theme.surface,
							fontSize: 20,
							letterSpacing: 4,
							textTransform: "uppercase",
						}}
					>
						{theme.chipLabel}
					</div>
					<div style={{ display: "flex", gap: 16, fontSize: 54, lineHeight: 1, letterSpacing: 1 }}>
						<span>{theme.first}</span>
						<span style={{ color: theme.accent }}>{theme.second}</span>
					</div>
				</div>
				{right}
			</div>
			{children}
		</div>
	);
}

const siteLabel = (host: string, seasonId: SeasonId) => (
	<span style={{ fontSize: 20, color: MUTED }}>
		{host}/{seasonId}
	</span>
);

export function BuildPreviewCard({
	seasonId,
	host,
	positive,
	negative,
	totals,
	icons,
}: {
	seasonId: SeasonId;
	host: string;
	positive: PreviewModifier[];
	negative: PreviewModifier[];
	totals: BuilderTotals;
	/** Modifier ID → PNG data URI. */
	icons: Map<string, string>;
}) {
	const density = pickDensity([positive.length, negative.length]);
	const sections = [
		{ kind: "positive", label: "Positive", modifiers: positive },
		{ kind: "negative", label: "Negative", modifiers: negative },
	] as const;
	const tileWidth = Math.floor((PREVIEW_IMAGE_SIZE.width - PADDING * 2 - (density.columns - 1) * density.gap) / density.columns);
	return (
		<Frame
			seasonId={seasonId}
			right={
				<div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
					{siteLabel(host, seasonId)}
					<div style={{ display: "flex", gap: 10, fontSize: 23, color: MUTED }}>
						<span>Granted</span>
						<span style={{ color: INK }}>+{totals.granted}</span>
						<span>·</span>
						<span>Spent</span>
						<span style={{ color: INK }}>−{totals.spent}</span>
						<span>·</span>
						<span>Net</span>
						<span style={{ color: totals.valid ? TONES.positive.chip : TONES.negative.chip }}>
							{totals.balance === 0 ? "0" : formatPoints(totals.balance)}
						</span>
					</div>
				</div>
			}
		>
			<div style={{ display: "flex", flexDirection: "column", gap: SECTION_GAP }}>
				{sections
					.filter((section) => section.modifiers.length > 0)
					.map((section) => (
						<div key={section.kind} style={{ display: "flex", flexDirection: "column" }}>
							<span
								style={{
									height: SECTION_LABEL,
									fontSize: 16,
									letterSpacing: 4,
									textTransform: "uppercase",
									color: MUTED,
								}}
							>
								{section.label}
							</span>
							<div style={{ display: "flex", flexWrap: "wrap", gap: density.gap }}>
								{section.modifiers.map((modifier) => {
									const icon = icons.get(modifier.id);
									return (
										<div
											key={modifier.id}
											style={{
												display: "flex",
												alignItems: "center",
												gap: Math.round(density.icon / 4),
												width: tileWidth,
												height: density.row,
												padding: `0 ${Math.round(density.gap * 1.2)}px`,
												borderRadius: 6,
												background: TONES[section.kind].tile,
											}}
										>
											{icon ? (
												// eslint-disable-next-line @next/next/no-img-element -- satori renders plain <img>
												<img src={icon} width={density.icon} height={density.icon} alt="" />
											) : (
												<div style={{ display: "flex", width: density.icon, height: density.icon }} />
											)}
											<span
												style={{
													display: "block",
													flex: 1,
													fontSize: density.font,
													lineHeight: 1.1,
													textTransform: "uppercase",
													lineClamp: 2,
													overflow: "hidden",
												}}
											>
												{modifier.name}
											</span>
											<span
												style={{
													padding: `1px ${Math.round(density.chip / 2.5)}px`,
													borderRadius: 999,
													fontSize: density.chip,
													background: TONES[section.kind].chip,
													color: "#000000",
												}}
											>
												{formatPoints(modifier.points)}
											</span>
										</div>
									);
								})}
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
	host,
	positiveCount,
	negativeCount,
}: {
	seasonId: SeasonId;
	host: string;
	positiveCount: number;
	negativeCount: number;
}) {
	return (
		<Frame seasonId={seasonId} right={siteLabel(host, seasonId)}>
			<div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, gap: 22 }}>
				<span style={{ fontSize: 56, lineHeight: 1.1 }}>Every modifier, plus a point-budget build planner</span>
				<span style={{ fontSize: 30, color: MUTED }}>
					{positiveCount} positive · {negativeCount} negative · share your build with one link
				</span>
			</div>
		</Frame>
	);
}

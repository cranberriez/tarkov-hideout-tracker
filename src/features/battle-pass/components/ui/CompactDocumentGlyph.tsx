import { documentMarks } from "../../lib/battle-pass-display";

const polygons: Record<string, string> = {
	triangle: "10,2 18,18 2,18",
	diamond: "10,2 18,10 10,18 2,10",
	octagon: "6,2 14,2 18,6 18,14 14,18 6,18 2,14 2,6",
	hexagon: "6,2 14,2 18,10 14,18 6,18 2,10",
	pentagon: "10,2 18,8 15,18 5,18 2,8",
	cross: "7,2 13,2 13,7 18,7 18,13 13,13 13,18 7,18 7,13 2,13 2,7 7,7",
	star: "10,2 12,7 18,8 14,12 15,18 10,15 5,18 6,12 2,8 8,7",
};

/** Screen-size document identity with a fixed map-ink outline, including on bright map artwork. */
export function CompactDocumentGlyph({ documentKey }: { documentKey: string }) {
	const shape = documentMarks[documentKey]?.shape ?? "square";
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 20 20"
			aria-hidden="true"
			focusable="false"
			fill="var(--document-color)"
			stroke="var(--map-marker-ink)"
			strokeWidth="2"
			strokeLinejoin="round"
		>
			{shape === "circle" ? (
				<circle cx="10" cy="10" r="8" />
			) : polygons[shape] ? (
				<polygon points={polygons[shape]} />
			) : (
				<rect x="2" y="2" width="16" height="16" />
			)}
		</svg>
	);
}

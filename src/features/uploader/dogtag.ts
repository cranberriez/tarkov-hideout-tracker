import type { IconImage } from "./icon-matching";

/** Generic faction tags; prestige and event variants share their art closely enough. */
export const DOGTAG_IDS = { bear: "59f32bb586f774757e1e8442", usec: "59f32c3b86f77472a31742f0" } as const;

/**
 * Whether a cell shows the player-level number dogtags carry in their bottom-left corner:
 * one to three bright, digit-shaped glyphs sharing a baseline near the left edge. Stack
 * counts and FIR marks sit bottom-right, so ordinary 1×1 items leave this corner empty.
 * The search reaches slightly past the fitted cell, which can sit a few pixels off.
 */
export function hasLevelNumber(
	shot: IconImage,
	cell: { left: number; top: number; width: number; height: number },
): boolean {
	const size = cell.width * shot.width;
	const reach = 0.03;
	const x0 = Math.max(0, Math.round(cell.left * shot.width - size * reach));
	const x1 = Math.min(shot.width, Math.round(cell.left * shot.width + size * 0.32));
	const y0 = Math.max(0, Math.round(cell.top * shot.height + size * 0.6));
	const y1 = Math.min(shot.height, Math.round(cell.top * shot.height + size * (1 + reach)));
	const across = x1 - x0,
		down = y1 - y0;
	if (across < 8 || down < 8) return false;
	const luma = new Float32Array(across * down);
	const chroma = new Float32Array(across * down);
	for (let y = 0; y < down; y++)
		for (let x = 0; x < across; x++) {
			const offset = ((y0 + y) * shot.width + x0 + x) * 4;
			const [r, g, b] = [shot.data[offset], shot.data[offset + 1], shot.data[offset + 2]];
			luma[y * across + x] = r * 0.299 + g * 0.587 + b * 0.114;
			chroma[y * across + x] = Math.max(r, g, b) - Math.min(r, g, b);
		}
	const sorted = [...luma].sort((a, b) => a - b);
	const background = sorted[Math.floor(sorted.length * 0.5)];
	const peak = sorted[Math.floor(sorted.length * 0.98)];
	if (peak - background < 60) return false;
	const threshold = background + (peak - background) * 0.5;
	const seen = new Uint8Array(luma.length);
	// Glyphs cut by the search edge belong to tag art or a neighboring cell, not the number.
	const glyphs: { left: number; right: number; top: number; bottom: number; pixels: number; chroma: number }[] = [];
	for (let start = 0; start < luma.length; start++) {
		if (seen[start] || luma[start] < threshold) continue;
		const glyph = { left: across, right: 0, top: down, bottom: 0, pixels: 0, chroma: 0 };
		const stack = [start];
		seen[start] = 1;
		while (stack.length) {
			const index = stack.pop()!;
			const x = index % across,
				y = (index - x) / across;
			glyph.left = Math.min(glyph.left, x);
			glyph.right = Math.max(glyph.right, x);
			glyph.top = Math.min(glyph.top, y);
			glyph.bottom = Math.max(glyph.bottom, y);
			glyph.pixels++;
			glyph.chroma += chroma[index];
			for (const next of [index - 1, index + 1, index - across, index + across]) {
				if (next < 0 || next >= luma.length || seen[next] || luma[next] < threshold) continue;
				if ((next === index - 1 && x === 0) || (next === index + 1 && x === across - 1)) continue;
				seen[next] = 1;
				stack.push(next);
			}
		}
		const width = (glyph.right - glyph.left + 1) / size,
			height = (glyph.bottom - glyph.top + 1) / size;
		const cut = glyph.left === 0 || glyph.top === 0 || glyph.right === across - 1 || glyph.bottom === down - 1;
		// Cell borders and selection outlines are thin lines, not glyphs.
		const line = (width < 0.02 && height > 0.2) || (height < 0.02 && width > 0.2);
		if (!cut && !line) glyphs.push(glyph);
	}
	const digits = glyphs.filter((glyph) => {
		const height = (glyph.bottom - glyph.top + 1) / size;
		const width = (glyph.right - glyph.left + 1) / size;
		const fill = glyph.pixels / ((glyph.bottom - glyph.top + 1) * (glyph.right - glyph.left + 1));
		// Level digits are white and taller than wide; the transfer arrows and mod badges that
		// share this corner are about square, and badges are colored.
		return (
			height >= 0.09 &&
			height <= 0.24 &&
			width >= 0.015 &&
			width <= 0.14 &&
			height / width >= 1.2 &&
			fill >= 0.15 &&
			fill <= 0.8 &&
			glyph.chroma / glyph.pixels < 60
		);
	});
	if (!digits.length || digits.length > 3) return false;
	const bottom = Math.max(...digits.map((glyph) => glyph.bottom));
	return (
		Math.min(...digits.map((glyph) => glyph.left)) / size - reach < 0.15 &&
		digits.every((glyph) => (bottom - glyph.bottom) / size < 0.04) &&
		// Anything else bright in the corner (artwork, a long caption) is not a level badge.
		glyphs.every((glyph) => digits.includes(glyph) || glyph.pixels < size * 0.02)
	);
}

const FACTION_SAMPLES = 16;
/** The tag body, clear of the name label, chain, level number, and FIR mark. */
const TAG_BODY = { left: 0.4, right: 0.9, top: 0.4, bottom: 0.95 };

/** Grayscale averages over a `FACTION_SAMPLES` square grid covering a pixel rectangle. */
function grayGrid(image: IconImage, left: number, top: number, width: number, height: number) {
	const values = new Float32Array(FACTION_SAMPLES * FACTION_SAMPLES);
	for (let row = 0; row < FACTION_SAMPLES; row++)
		for (let column = 0; column < FACTION_SAMPLES; column++) {
			let sum = 0,
				count = 0;
			const y1 = Math.min(image.height, Math.floor(top + ((row + 1) * height) / FACTION_SAMPLES));
			const x1 = Math.min(image.width, Math.floor(left + ((column + 1) * width) / FACTION_SAMPLES));
			for (let y = Math.max(0, Math.floor(top + (row * height) / FACTION_SAMPLES)); y < y1; y++)
				for (let x = Math.max(0, Math.floor(left + (column * width) / FACTION_SAMPLES)); x < x1; x++) {
					const offset = (y * image.width + x) * 4;
					sum += image.data[offset] + image.data[offset + 1] + image.data[offset + 2];
					count++;
				}
			values[row * FACTION_SAMPLES + column] = count ? sum / count : 0;
		}
	return values;
}

function bodyCorrelation(a: Float32Array, b: Float32Array) {
	const indices: number[] = [];
	for (let row = 0; row < FACTION_SAMPLES; row++)
		for (let column = 0; column < FACTION_SAMPLES; column++)
			if (
				column >= TAG_BODY.left * FACTION_SAMPLES &&
				column < TAG_BODY.right * FACTION_SAMPLES &&
				row >= TAG_BODY.top * FACTION_SAMPLES &&
				row < TAG_BODY.bottom * FACTION_SAMPLES
			)
				indices.push(row * FACTION_SAMPLES + column);
	const meanA = indices.reduce((sum, index) => sum + a[index], 0) / indices.length;
	const meanB = indices.reduce((sum, index) => sum + b[index], 0) / indices.length;
	let product = 0,
		energyA = 0,
		energyB = 0;
	for (const index of indices) {
		product += (a[index] - meanA) * (b[index] - meanB);
		energyA += (a[index] - meanA) ** 2;
		energyB += (b[index] - meanB) ** 2;
	}
	return energyA && energyB ? product / Math.sqrt(energyA * energyB) : 0;
}

/**
 * Which faction's tag a dogtag cell shows. Both tags look alike to the coarse artwork match,
 * but BEAR's text runs along the tag while USEC's sits in rows, which a finer grayscale
 * comparison of the tag body separates. Returns the index of the closer icon.
 */
export function closerFaction(
	shot: IconImage,
	cell: { left: number; top: number; width: number; height: number },
	icons: readonly [IconImage, IconImage],
): 0 | 1 {
	const inset = 0.05;
	const references = icons.map((icon) =>
		grayGrid(
			icon,
			icon.width * inset,
			icon.height * inset,
			icon.width * (1 - 2 * inset),
			icon.height * (1 - 2 * inset),
		),
	);
	const size = cell.width * shot.width;
	const best = [-Infinity, -Infinity];
	// The fitted cell can sit a few pixels off the true one.
	for (const dx of [-0.04, 0, 0.04])
		for (const dy of [-0.04, 0, 0.04]) {
			const values = grayGrid(
				shot,
				cell.left * shot.width + size * (inset + dx),
				cell.top * shot.height + size * (inset + dy),
				size * (1 - 2 * inset),
				size * (1 - 2 * inset),
			);
			references.forEach((reference, index) => {
				best[index] = Math.max(best[index], bodyCorrelation(values, reference));
			});
		}
	return best[0] >= best[1] ? 0 : 1;
}

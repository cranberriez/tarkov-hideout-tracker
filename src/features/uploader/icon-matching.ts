import type { ItemSummary } from "../../types/items";
import { clampBox, overlapFraction, type BoxBounds, type ReviewBox, type ReviewGrid } from "./review-model";

/** RGBA pixels of a catalog grid image: 64 px for one cell, about 63.5 px per extra cell. */
export interface IconImage {
	data: Uint8ClampedArray;
	width: number;
	height: number;
}
export type IconLoader = (item: ItemSummary) => Promise<IconImage | null>;

const SAMPLES = 16;
/** Cell borders differ between the game and catalog renders. */
const INSET = 0.05;
/** Label rows and fitted cells can sit a few pixels off the true cell. */
const SHIFTS = [-0.04, 0, 0.04];

export function iconCells(icon: Pick<IconImage, "width" | "height">) {
	return { columns: Math.max(1, Math.round(icon.width / 63.5)), rows: Math.max(1, Math.round(icon.height / 63.5)) };
}

/** Area-averaged RGB samples over `across` × `down` points, read through an optional quarter turn. */
function sample(image: IconImage, region: BoxBounds, across: number, down: number, turn: 0 | 1 | -1) {
	const values = new Float32Array(across * down * 3);
	// A turned icon is read along its own axes, then written rotated to match the screenshot.
	const sourceAcross = turn ? down : across,
		sourceDown = turn ? across : down;
	const stepX = region.width / sourceAcross,
		stepY = region.height / sourceDown;
	for (let sy = 0; sy < sourceDown; sy++)
		for (let sx = 0; sx < sourceAcross; sx++) {
			let r = 0,
				g = 0,
				b = 0,
				n = 0;
			const x0 = Math.floor(region.left + sx * stepX),
				x1 = Math.max(x0 + 1, Math.floor(region.left + (sx + 1) * stepX));
			const y0 = Math.floor(region.top + sy * stepY),
				y1 = Math.max(y0 + 1, Math.floor(region.top + (sy + 1) * stepY));
			for (let y = Math.max(0, y0); y < Math.min(image.height, y1); y++)
				for (let x = Math.max(0, x0); x < Math.min(image.width, x1); x++) {
					const offset = (y * image.width + x) * 4;
					r += image.data[offset];
					g += image.data[offset + 1];
					b += image.data[offset + 2];
					n++;
				}
			if (!n) continue;
			// Clockwise: a source column becomes a target row counted from the right.
			const tx = turn === 1 ? across - 1 - sy : turn === -1 ? sy : sx;
			const ty = turn === 1 ? sx : turn === -1 ? down - 1 - sx : sy;
			const target = (ty * across + tx) * 3;
			values[target] = r / n;
			values[target + 1] = g / n;
			values[target + 2] = b / n;
		}
	return values;
}

/** Labels, FIR/stack text, and the transfer or SPEC marks are screenshot overlays the catalog icon lacks. */
function overlayMask(across: number, down: number) {
	const keep = new Uint8Array(across * down);
	const corner = Math.ceil(SAMPLES * 0.35);
	for (let y = 0; y < down; y++)
		for (let x = 0; x < across; x++)
			keep[y * across + x] = Number(
				y >= Math.ceil(SAMPLES * 0.3) && !(y >= down - corner && (x < corner * 1.6 || x >= across - corner * 1.6)),
			);
	return keep;
}

/** Mean of normalized correlation (shape) and brightness-matched absolute difference (color). */
function similarity(a: Float32Array, b: Float32Array, keep: Uint8Array) {
	let sumA = 0,
		sumB = 0,
		count = 0;
	for (let i = 0; i < keep.length; i++)
		if (keep[i])
			for (let c = 0; c < 3; c++) {
				sumA += a[i * 3 + c];
				sumB += b[i * 3 + c];
				count++;
			}
	if (!count) return 0;
	const meanA = sumA / count,
		meanB = sumB / count,
		gain = sumA / Math.max(1, sumB);
	let product = 0,
		energyA = 0,
		energyB = 0,
		difference = 0;
	for (let i = 0; i < keep.length; i++)
		if (keep[i])
			for (let c = 0; c < 3; c++) {
				const va = a[i * 3 + c],
					vb = b[i * 3 + c];
				product += (va - meanA) * (vb - meanB);
				energyA += (va - meanA) ** 2;
				energyB += (vb - meanB) ** 2;
				difference += Math.abs(va - vb * gain);
			}
	const correlation = energyA && energyB ? product / Math.sqrt(energyA * energyB) : 0;
	return (correlation + 1 - difference / count / 64) / 2;
}

/** Screenshot samples depend only on placement, so a catalog-wide search reuses them. */
type ShotSamples = Map<string, Float32Array>;

/**
 * How closely a catalog icon matches the screenshot at a box. Labels anchor the top-right
 * cell, so each orientation is placed from there at the icon's own size; a measured
 * footprint that fits neither orientation is penalized. A relative score, not a probability.
 */
function matchIcon(
	shot: IconImage,
	box: BoxBounds,
	cellPixels: number,
	icon: IconImage,
	measured: boolean,
	cache: ShotSamples = new Map(),
) {
	const { columns, rows } = iconCells(icon);
	const right = (box.left + box.width) * shot.width;
	const top = box.top * shot.height;
	const boxColumns = Math.round((box.width * shot.width) / cellPixels);
	const boxRows = Math.round((box.height * shot.height) / cellPixels);
	let best = { score: -1, across: columns, down: rows };
	for (const turn of columns === rows ? ([0] as const) : ([0, 1, -1] as const)) {
		const across = turn ? rows : columns,
			down = turn ? columns : rows;
		const left = right - across * cellPixels;
		if (left < -cellPixels * 0.1 || top + down * cellPixels > shot.height + cellPixels * 0.1) continue;
		const fits = across === boxColumns && down === boxRows;
		const sampleAcross = across * SAMPLES,
			sampleDown = down * SAMPLES;
		const keep = overlayMask(sampleAcross, sampleDown);
		const iconAcross = turn ? down : across,
			iconDown = turn ? across : down;
		const reference = sample(
			icon,
			{
				left: (icon.width * INSET) / iconAcross,
				top: (icon.height * INSET) / iconDown,
				width: icon.width * (1 - (2 * INSET) / iconAcross),
				height: icon.height * (1 - (2 * INSET) / iconDown),
			},
			sampleAcross,
			sampleDown,
			turn,
		);
		for (const dx of SHIFTS)
			for (const dy of SHIFTS) {
				const region = {
					left: left + cellPixels * (INSET + dx),
					top: top + cellPixels * (INSET + dy),
					width: (across - 2 * INSET) * cellPixels,
					height: (down - 2 * INSET) * cellPixels,
				};
				const key = `${region.left}:${region.top}:${across}:${down}`;
				let values = cache.get(key);
				if (!values) cache.set(key, (values = sample(shot, region, sampleAcross, sampleDown, 0)));
				const raw = similarity(values, reference, keep);
				const score = measured && !fits ? raw - 0.3 : raw;
				if (score > best.score) best = { score, across, down };
			}
	}
	return best;
}

export function iconSimilarity(
	shot: IconImage,
	box: BoxBounds,
	cellPixels: number,
	icon: IconImage,
	measured: boolean,
): number {
	return matchIcon(shot, box, cellPixels, icon, measured).score;
}

interface Scored {
	item: ItemSummary;
	score: number;
	across: number;
	down: number;
}

/** Best match and its lead over the best differently named item (same-name variants share art). */
function leader(scored: readonly Scored[]) {
	const [best] = scored;
	if (!best) return null;
	const rival = scored.find((entry) => entry.item.name !== best.item.name);
	return { ...best, lead: best.score - (rival?.score ?? 0) };
}

// Artwork leads needed before it decides an identity, calibrated on known stash screenshots.
/** Among a read's candidates. */
const CANDIDATE_LEAD = 0.03;
const CANDIDATE_FLOOR = 0.7;
/** Among all barter items, for a box whose label did not settle an identity. */
const SEARCH_LEAD = 0.05;
const SEARCH_FLOOR = 0.75;
/** Among all barter items, for a cell without any read label. */
const UNLABELED_LEAD = 0.06;
const UNLABELED_FLOOR = 0.8;
/** A read's identity is only replaced when another candidate's artwork is far closer. */
const OVERRIDE_LEAD = 0.1;
const SUGGESTIONS = 5;

function luminanceSpread(shot: IconImage, region: BoxBounds) {
	let sum = 0,
		squares = 0,
		count = 0;
	const x0 = Math.max(0, Math.floor(region.left * shot.width)),
		x1 = Math.min(shot.width, Math.ceil((region.left + region.width) * shot.width));
	const y0 = Math.max(0, Math.floor(region.top * shot.height)),
		y1 = Math.min(shot.height, Math.ceil((region.top + region.height) * shot.height));
	for (let y = y0; y < y1; y += 2)
		for (let x = x0; x < x1; x += 2) {
			const offset = (y * shot.width + x) * 4;
			const value = (shot.data[offset] + shot.data[offset + 1] + shot.data[offset + 2]) / 3;
			sum += value;
			squares += value * value;
			count++;
		}
	return count ? Math.sqrt(Math.max(0, squares / count - (sum / count) ** 2)) : 0;
}

export interface IconRefinement {
	shot: IconImage;
	grid: ReviewGrid;
	/** Box IDs whose footprint was measured from borders, so its size is evidence. */
	measured: ReadonlySet<string>;
	barterItems: readonly ItemSummary[];
	load: IconLoader;
	signal: AbortSignal;
	onProgress?: (progress: number) => void;
}

/**
 * Re-rank candidates by catalog artwork. A read's candidates are compared first; boxes still
 * unresolved are compared with every barter item, which can assign a clear winner and
 * otherwise supplies the closest matches as suggestions. Finally, occupied cells no box
 * covers (labels OCR missed entirely) gain a box when one barter item clearly matches.
 */
export async function refineWithIcons(
	boxes: readonly ReviewBox[],
	{ shot, grid, measured, barterItems, load, signal, onProgress = () => {} }: IconRefinement,
): Promise<ReviewBox[]> {
	const cellPixels = grid.cellWidth * shot.width;
	/** The matched icon's footprint, anchored at the box's labeled top-right cell. */
	const placement = (box: BoxBounds, match: { across: number; down: number }) =>
		clampBox({
			left: box.left + box.width - match.across * grid.cellWidth,
			top: box.top,
			width: match.across * grid.cellWidth,
			height: match.down * grid.cellHeight,
		});
	const icons = new Map<string, Promise<IconImage | null>>();
	const icon = (item: ItemSummary) => {
		if (!icons.has(item.id))
			icons.set(
				item.id,
				load(item).catch(() => null),
			);
		return icons.get(item.id)!;
	};
	const score = async (bounds: BoxBounds, isMeasured: boolean, items: readonly ItemSummary[]) => {
		const images = await Promise.all(items.map(icon));
		signal.throwIfAborted();
		const cache: ShotSamples = new Map();
		return items
			.flatMap((item, index) => {
				const image = images[index];
				return image ? [{ item, ...matchIcon(shot, bounds, cellPixels, image, isMeasured, cache) }] : [];
			})
			.sort((a, b) => b.score - a.score);
	};
	const result: ReviewBox[] = [];
	for (const [index, box] of boxes.entries()) {
		onProgress(index / (boxes.length + 1));
		let { itemId, candidates, bounds } = box;
		if (candidates.length) {
			const scored = await score(box.bounds, measured.has(box.id), candidates.slice(0, 8));
			const best = leader(scored);
			const current = scored.find((entry) => entry.item.id === itemId);
			if (
				best &&
				best.lead >= CANDIDATE_LEAD &&
				best.score >= CANDIDATE_FLOOR &&
				(!current || best.score - current.score >= OVERRIDE_LEAD)
			)
				itemId = best.item.id;
			const chosen = scored.find((entry) => entry.item.id === itemId);
			// An unmeasured box only guessed its size; the matched art knows it.
			if (chosen && !measured.has(box.id) && chosen.score >= CANDIDATE_FLOOR) bounds = placement(box.bounds, chosen);
			const order = new Map(scored.map((entry, rank) => [entry.item.id, rank]));
			candidates = [...candidates].sort((a, b) => (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity));
		}
		if (!itemId && barterItems.length) {
			const scored = await score(box.bounds, measured.has(box.id), barterItems);
			const best = leader(scored);
			if (best && best.lead >= SEARCH_LEAD && best.score >= SEARCH_FLOOR) {
				itemId = best.item.id;
				if (!measured.has(box.id)) bounds = placement(box.bounds, best);
			}
			candidates = [
				...new Map(
					[...scored.slice(0, SUGGESTIONS).map((entry) => entry.item), ...candidates].map((item) => [item.id, item]),
				).values(),
			];
		}
		result.push({ ...box, itemId, candidates, bounds });
	}
	if (!barterItems.length) return result;

	const occupied = (x: number, y: number) =>
		result.some(
			(box) =>
				x > box.bounds.left &&
				x < box.bounds.left + box.bounds.width &&
				y > box.bounds.top &&
				y < box.bounds.top + box.bounds.height,
		);
	const firstLeft = grid.left - Math.floor(grid.left / grid.cellWidth) * grid.cellWidth;
	const firstTop = grid.top - Math.floor(grid.top / grid.cellHeight) * grid.cellHeight;
	const columns = Math.floor((1 - firstLeft) / grid.cellWidth + 0.1);
	// Rows top-down and columns right-to-left reach a multi-cell item's labeled corner first.
	for (let top = firstTop; top + grid.cellHeight * 0.9 <= 1; top += grid.cellHeight)
		for (let column = columns - 1; column >= 0; column--) {
			const left = firstLeft + column * grid.cellWidth;
			if (left + grid.cellWidth > 1.01 || occupied(left + grid.cellWidth / 2, top + grid.cellHeight / 2)) continue;
			const cell = { left, top, width: grid.cellWidth, height: grid.cellHeight };
			// Empty stash cells are a nearly flat background.
			if (luminanceSpread(shot, cell) < 18) continue;
			const scored = await score(cell, false, barterItems);
			const best = leader(scored);
			if (!best || best.lead < UNLABELED_LEAD || best.score < UNLABELED_FLOOR) continue;
			const bounds = placement(cell, best);
			// An unresolved fragment of this item's label (e.g. half its name) is the same item.
			for (let i = result.length - 1; i >= 0; i--) {
				const other = result[i];
				if (!other.itemId && overlapFraction(other.bounds, bounds) > 0.7) result.splice(i, 1);
			}
			result.push({
				id: `cell:${top.toFixed(4)}:${left.toFixed(4)}`,
				bounds,
				text: "",
				candidates: scored.slice(0, SUGGESTIONS).map((entry) => entry.item),
				itemId: best.item.id,
				quantity: 1,
				confirmed: false,
				foundInRaid: "unknown",
				firConfirmed: false,
			});
		}
	onProgress(1);
	return result.sort((a, b) => a.bounds.top - b.bounds.top || a.bounds.left - b.bounds.left);
}

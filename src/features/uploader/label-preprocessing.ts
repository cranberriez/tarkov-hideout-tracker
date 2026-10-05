import { isolateLabelRegions, type LabelRegion } from "./label-regions";
import type { inferLabelGrid } from "./recognition-model";

/** Keep both neutral and colored text; either mask can recover a label the other loses. */
export function prepareLabelPixels(rgba: Uint8ClampedArray) {
	const masks = Array.from({ length: 4 }, () => new Uint8Array(rgba.length / 4));
	for (let i = 0; i < rgba.length; i += 4) {
		const value = 255 - (rgba[i] * 0.299 + rgba[i + 1] * 0.587 + rgba[i + 2] * 0.114);
		const chroma = Math.max(rgba[i], rgba[i + 1], rgba[i + 2]) - Math.min(rgba[i], rgba[i + 1], rgba[i + 2]);
		masks[0][i / 4] = value < 155 ? 0 : 255;
		masks[1][i / 4] = value < 155 && chroma < 35 ? 0 : 255;
		masks[2][i / 4] = value < 140 ? 0 : 255;
		masks[3][i / 4] = value < 140 && chroma < 35 ? 0 : 255;
		rgba[i] = rgba[i + 1] = rgba[i + 2] = value;
		rgba[i + 3] = 255;
	}
	return masks;
}

export interface LabelTask {
	top: number;
	mask: Uint8Array;
	region: LabelRegion;
}

export function buildLabelTasks(
	masks: readonly Uint8Array[],
	width: number,
	height: number,
	grid: NonNullable<ReturnType<typeof inferLabelGrid>>,
): LabelTask[] {
	const tasks: LabelTask[] = [];
	const seen = new Map<string, LabelTask[]>();
	// Grid tolerance measures row alignment, not a safe OCR crop margin. Using it
	// here includes borders and artwork that swallow or distort the small labels.
	const tightPadding = Math.max(1, Math.round(grid.textHeight * 0.1));
	// A second, wider crop retains ascenders/descenders on rows with imperfect
	// alignment. It complements the tight crop; it never replaces its evidence.
	for (const [padding, sources] of [
		[tightPadding, masks],
		[grid.tolerance, masks.slice(0, 2)],
	] as const) {
		for (let top = grid.firstTop; top < height; top += grid.pitch) {
			const start = Math.max(0, Math.floor(top - padding));
			const end = Math.min(height, Math.ceil(top + grid.textHeight + padding));
			for (const source of sources) {
				const mask = source.slice(start * width, end * width);
				for (const region of isolateLabelRegions(mask, width, end - start, grid.textHeight)) {
					const key = `${start + region.top}:${region.left}:${region.width}:${region.height}`;
					const previous = seen.get(key) ?? [];
					const identical = previous.some((task) => {
						for (let y = 0; y < region.height; y++)
							for (let x = 0; x < region.width; x++)
								if (
									mask[(region.top + y) * width + region.left + x] !==
									task.mask[(task.region.top + y) * width + task.region.left + x]
								)
									return false;
						return true;
					});
					if (identical) continue;
					const task = { top: start, mask, region };
					tasks.push(task);
					seen.set(key, [...previous, task]);
					if (tasks.length > 800)
						throw new Error("There are too many text regions. Crop the screenshot to one container.");
				}
			}
		}
	}
	return tasks;
}

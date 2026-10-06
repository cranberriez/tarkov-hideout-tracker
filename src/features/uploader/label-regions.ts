export interface LabelRegion {
	left: number;
	top: number;
	width: number;
	height: number;
}

/** Clean grid-border strokes, then separate neighboring labels by their whitespace. */
export function isolateLabelRegions(
	mask: Uint8Array,
	width: number,
	height: number,
	textHeight: number,
): LabelRegion[] {
	if (mask.length !== width * height || width <= 0 || height <= 0 || textHeight <= 0) return [];
	for (let y = 0; y < height; y++) {
		let start = -1;
		for (let x = 0; x <= width; x++) {
			if (x < width && mask[y * width + x] === 0) {
				if (start < 0) start = x;
			} else if (start >= 0) {
				if (x - start > textHeight * 4) mask.fill(255, y * width + start, y * width + x);
				start = -1;
			}
		}
	}
	for (let x = 0; x < width; x++) {
		let start = -1;
		for (let y = 0; y <= height; y++) {
			if (y < height && mask[y * width + x] === 0) {
				if (start < 0) start = y;
			} else if (start >= 0) {
				if (y - start > textHeight * 1.5) for (let row = start; row < y; row++) mask[row * width + x] = 255;
				start = -1;
			}
		}
	}
	const regions: LabelRegion[] = [];
	const add = (left: number, right: number) => {
		let top = height;
		let bottom = -1;
		for (let y = 0; y < height; y++)
			for (let x = left; x <= right; x++) {
				if (mask[y * width + x] === 0) {
					top = Math.min(top, y);
					bottom = Math.max(bottom, y);
				}
			}
		const regionHeight = bottom - top + 1;
		if (regionHeight >= textHeight * 0.4 && regionHeight <= textHeight * 1.5 && right - left + 1 >= textHeight * 0.35)
			regions.push({ left, top, width: right - left + 1, height: regionHeight });
	};
	let left = -1;
	let last = -1;
	for (let x = 0; x < width; x++) {
		let ink = false;
		for (let y = 0; y < height; y++)
			if (mask[y * width + x] === 0) {
				ink = true;
				break;
			}
		if (ink) {
			if (left < 0) left = x;
			last = x;
		} else if (left >= 0 && x - last > textHeight * 0.45) {
			add(left, last);
			left = -1;
		}
	}
	if (left >= 0) add(left, last);
	return regions;
}

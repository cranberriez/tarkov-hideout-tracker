import assert from "node:assert/strict";
import test from "node:test";
import samples from "./fir-samples.json";
import { scoreFoundInRaid, detectFoundInRaid } from "./found-in-raid";

test("independent screenshot corners distinguish FIR badges from artwork and transfer symbols", () => {
	for (const sample of samples)
		for (const scale of [1, 2]) {
			const width = 100 * scale,
				data = new Uint8ClampedArray(width * width * 4);
			const gray = Buffer.from(sample.hex, "hex");
			for (let y = 0; y < 24 * scale; y++)
				for (let x = 0; x < 24 * scale; x++) {
					const at = ((y + 63 * scale) * width + x + 63 * scale) * 4;
					const value = gray[Math.floor(y / scale) * 24 + Math.floor(x / scale)];
					data[at] = data[at + 1] = data[at + 2] = value;
				}
			const score = scoreFoundInRaid(
				data,
				width,
				width,
				{ left: 0.03, top: 0.03, width: 0.84, height: 0.84 },
				84 * scale,
			);
			assert.equal(score >= 0.82, sample.detected, `${sample.name}, scale ${scale}, score ${score}`);
		}
});
test("missing geometry, tiny icons, and flat corners remain unknown", () => {
	const data = new Uint8ClampedArray(100 * 100 * 4).fill(80);
	assert.equal(scoreFoundInRaid(data, 100, 100, { left: 0, top: 0, width: 0.9, height: 0.9 }, 25), 0);
	assert.equal(scoreFoundInRaid(data, 100, 100, { left: 0, top: 0, width: 0.9, height: 0.9 }, 84), 0);
	const result = detectFoundInRaid(data, 100, 100, [
		{
			id: "x",
			text: "item",
			confidence: 95,
			match: "exact",
			candidates: [],
			bounds: { left: 0.1, top: 0.1, width: 0.1, height: 0.01 },
		},
	]);
	assert.equal(result[0].foundInRaid, "unknown");
});

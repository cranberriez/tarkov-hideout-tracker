import loadHighs from "./highs/highs.mjs";
/** Seconds; an unproven route reports failure rather than leaving the page calculating forever. */
const TIME_LIMIT = 20;
self.onmessage = async ({ data: { model } }) => {
	try {
		const highs = await loadHighs();
		const result = highs.solve(model, { output_flag: false, mip_rel_gap: 0, time_limit: TIME_LIMIT });
		self.postMessage(result.Status === "Optimal" ? result.Columns : null);
	} catch {
		self.postMessage(null);
	}
};

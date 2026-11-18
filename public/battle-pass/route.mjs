import loadHighs from "./highs/highs.mjs";
self.onmessage = async ({ data: { model } }) => {
	try {
		const highs = await loadHighs();
		const result = highs.solve(model, { output_flag: false, mip_rel_gap: 0 });
		self.postMessage(result.Status === "Optimal" ? result.Columns : null);
	} catch {
		self.postMessage(null);
	}
};

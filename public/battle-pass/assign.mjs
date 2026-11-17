import loadHighs from "./highs/highs.mjs";

self.onmessage = async ({ data: { model, profileCount, rewardCount } }) => {
	try {
		const highs = await loadHighs();
		const result = highs.solve(model, { output_flag: false, mip_rel_gap: 0 });
		if (result.Status !== "Optimal") throw new Error(result.Status);
		const owners = Array.from({ length: rewardCount }, (_, i) => {
			for (let p = 0; p < profileCount; p++) if (result.Columns[`x_${i}_${p}`].Primal > 0.5) return p;
			throw new Error("Missing purchase assignment");
		});
		self.postMessage(owners);
	} catch {
		self.postMessage(null);
	}
};

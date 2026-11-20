import { useEffect, useMemo, useState } from "react";
import type { ProfileDocuments } from "./useProfileDocuments";
import type { Tile } from "./lib/battle-pass-model";
import { assignedStock, purchaseModel } from "./lib/purchase-model";

export function usePurchasePlan(enabled: boolean, rewards: Tile[], documents: ProfileDocuments) {
	const request = useMemo(() => {
		if (!enabled) return null;
		const inventories = documents.profiles.map((p) => p.inventory);
		return { inventories, model: purchaseModel(rewards, inventories) };
	}, [enabled, rewards, documents]);
	const [result, setResult] = useState<{ request: typeof request; owners: number[] | null } | null>(null);
	useEffect(() => {
		if (!request?.model) return;
		const worker = new Worker("/battle-pass/assign.mjs", { type: "module" });
		worker.onmessage = (event) => {
			setResult({ request, owners: event.data });
			worker.terminate();
		};
		worker.onerror = () => {
			setResult({ request, owners: null });
			worker.terminate();
		};
		worker.postMessage({ model: request.model, rewardCount: rewards.length, profileCount: request.inventories.length });
		return () => worker.terminate();
	}, [request, rewards]);
	if (!request) return null;
	const owners = request.model ? (result?.request === request ? result.owners : undefined) : rewards.map(() => 0);
	if (!owners) return owners === null ? "Could not calculate profile purchases." : "Calculating profile purchases…";
	return {
		stock: assignedStock(rewards, request.inventories, owners),
		labels: Object.fromEntries(rewards.map((r, i) => [r.id, documents.profiles[owners[i]].label])),
	};
}

import { readActiveReleaseId } from "./release-diff.mjs";

export async function readReleasePrices(client, mode) {
	const releaseId = await readActiveReleaseId(client, mode);
	const result = await client.execute({
		sql: "SELECT entity_id, payload_json, updated_at FROM data_entities WHERE mode = ? AND release_id = ? AND entity_type = 'price'",
		args: [mode, releaseId],
	});
	if (!result.rows.length) throw new Error(`No price snapshot in ${mode}/${releaseId}; refusing to discard the existing fallback.`);
	return {
		releaseId,
		prices: new Map(
			result.rows.map((row) => [
				String(row.entity_id),
				{
					payload: JSON.parse(String(row.payload_json)),
					updatedAt: Number(row.updated_at),
				},
			]),
		),
	};
}

export function preserveItemPrices(items, prices) {
	return items.map((item) => ({ ...item, marketPrice: prices.get(item.id)?.payload ?? null }));
}

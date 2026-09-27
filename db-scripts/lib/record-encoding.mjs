import crypto from "node:crypto";

// Canonical snapshot identity is independent of the storage engine. Hash this
// representation before insertion; never hash PostgreSQL JSONB's serialized text.
export function stableStringify(value) {
	return JSON.stringify(value, (_key, item) =>
		item && typeof item === "object" && !Array.isArray(item)
			? Object.fromEntries(
					Object.keys(item)
						.sort()
						.map((key) => [key, item[key]]),
				)
			: item,
	);
}
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
export function encodeRecord(mode, record) {
	const content = { ...record };
	delete content.updatedAt;
	if (record.type === "itemView" && record.payload) {
		content.payload = {
			...record.payload,
			freshness: Object.fromEntries(
				Object.entries(record.payload.freshness ?? {}).map(([key, value]) => [key, value == null ? null : 0]),
			),
		};
	}
	const payloadJson = stableStringify(content.payload);
	return {
		mode,
		recordType: record.type,
		recordId: record.entityId ?? record.itemId ?? record.manifestName,
		variant: record.entityType ?? record.viewType ?? "",
		payloadJson,
		payloadHash: hash(payloadJson),
		contentHash: hash(stableStringify(content)),
		sortKey: record.sortKey ?? record.sortName ?? null,
		normalizedName: record.normalizedName ?? null,
		compactName: record.compactName ?? null,
		updatedAt: record.updatedAt ?? 0,
	};
}
export const recordKey = (record) => JSON.stringify([record.recordType, record.recordId, record.variant]);

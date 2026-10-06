import type { ItemSummary } from "@/types/items";
import type { UploaderSummaryData } from "@/types/uploader";
import { buildItemDemand, type DemandProfile, type KappaDemand } from "../items/demand/item-demand-model";
import { summarizeReview, type ReviewEntry } from "./review-model";

export type {
	ItemNeed,
	KappaDemand,
	SaveReason,
	SummaryCategory,
	SummaryRow,
} from "../items/demand/item-demand-model";

/** Scanned and manually added entries split into kept and surplus copies. */
export function buildUploaderSummary(
	entries: readonly ReviewEntry[],
	items: readonly ItemSummary[],
	data: UploaderSummaryData,
	profile: DemandProfile,
	owned?: Readonly<Record<string, { have: number; haveFir: number } | undefined>>,
	unitValue?: (itemId: string) => number | undefined,
	kappa?: KappaDemand,
) {
	const summary = summarizeReview(entries, items);
	return {
		...buildItemDemand(summary.totals, items, data, profile, owned, unitValue, kappa),
		unresolved: summary.unresolved,
	};
}

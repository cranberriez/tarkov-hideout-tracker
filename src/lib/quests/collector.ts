import type { TarkovDataMode } from "../../types/common";

/** The Collector (Kappa) quest; its hand-ins are tracked by the Kappa checklist, not quest progress. */
export const COLLECTOR_QUEST_ID_BY_MODE: Record<TarkovDataMode, string> = {
	regular: "5c51aac186f77432ea65c552",
	pve: "5c51aac186f77432ea65c552",
	"pvp-season": "5c51aac186f77432ea65c552",
};

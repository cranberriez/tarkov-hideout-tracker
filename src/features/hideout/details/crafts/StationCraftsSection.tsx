"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { DataNotice } from "@/components/ui/data-notice";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { useUserStore } from "@/lib/stores/useUserStore";
import type { ProfitPageData } from "@/types/contracts";
import { WikiSection } from "../components/WikiSection";
import { useStationDetails } from "../StationDetailsContext";
import { StationCraftRow } from "./StationCraftRow";
import { StationCraftsSkeleton } from "./StationCraftsSkeleton";
import { craftLock, filterCrafts, groupCraftsByLevel, stationCrafts } from "./station-crafts-model";
import { useStationCraftData, useStationCraftEvaluations } from "./useStationCraftEvaluations";

/**
 * Crafts available at the saved level; "All levels" adds locked higher-level crafts and is
 * hidden once the station is maxed. Hidden entirely when the station has no tracked crafts.
 */
export function StationCraftsSection({
	mode,
	fallbackData,
}: {
	mode: TarkovJsonGameMode;
	fallbackData: ProfitPageData | null;
}) {
	const { station, currentLevel } = useStationDetails();
	const isMaxed = currentLevel >= station.levels.length;
	const [showAllLevels, setShowAllLevels] = useState(false);
	const allLevels = showAllLevels && !isMaxed;
	const completedQuests = useUserStore((state) => state.completedQuests);
	const { query, enabled, data } = useStationCraftData(mode, fallbackData);
	const all = useMemo(() => {
		const names = new Map((data?.items ?? []).map((item) => [item.id, item.shortName || item.name]));
		return stationCrafts(data?.crafts ?? [], station.id, (itemId) => names.get(itemId) ?? "");
	}, [data?.crafts, data?.items, station.id]);
	const visible = useMemo(
		() => filterCrafts(all, allLevels, currentLevel),
		[all, allLevels, currentLevel],
	);
	const { evaluationsById, itemsById, status, unavailableReason } = useStationCraftEvaluations(mode, data, visible);

	if (!data && (query.isPending || !enabled)) return <StationCraftsSkeleton />;
	if (!data || data.errors.crafts) {
		return (
			<WikiSection title="Crafts">
				<DataNotice
					action={
						<Button size="xs" onClick={() => void query.refetch()}>
							Retry
						</Button>
					}
				>
					{data?.errors.crafts ?? "Craft data could not be loaded."}
				</DataNotice>
			</WikiSection>
		);
	}
	if (all.length === 0) return null;

	const grouped = new Set(visible.map((craft) => craft.level)).size > 1;
	const rowProps = { itemsById, status, unavailableReason, taskUnlocksById: data.taskUnlocksById };
	const renderRows = (crafts: typeof visible) => (
		<ul className="flex flex-col divide-y divide-highlight/8 xl:gap-7 xl:divide-y-0">
			{crafts.map((craft) => (
				<StationCraftRow
					key={craft.id}
					craft={craft}
					evaluation={evaluationsById[craft.id]}
					lock={craftLock(craft, currentLevel, completedQuests)}
					{...rowProps}
				/>
			))}
		</ul>
	);

	return (
		<WikiSection
			title="Crafts"
			description={allLevels ? undefined : `Available at level ${currentLevel}.`}
			actions={
				isMaxed ? undefined : (
					<Button
						size="xs"
						selected={allLevels}
						aria-pressed={allLevels}
						onClick={() => setShowAllLevels((value) => !value)}
					>
						All levels
					</Button>
				)
			}
		>
			{visible.length === 0 ? (
				<DataNotice tone="empty">
					No crafts available yet. {all.length} unlock at higher levels; use All levels to preview them.
				</DataNotice>
			) : grouped ? (
				<div className="flex flex-col gap-7">
					{groupCraftsByLevel(visible).map((group) => (
						<div key={group.level}>
							<h3 className="mb-3 text-sm font-semibold text-foreground">Level {group.level}</h3>
							{renderRows(group.crafts)}
						</div>
					))}
				</div>
			) : (
				renderRows(visible)
			)}
		</WikiSection>
	);
}

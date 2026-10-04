"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useShallow } from "zustand/react/shallow";
import { getStationPreviewUpgrade } from "@/features/hideout/station-preview-model";
import { normalizeName } from "@/lib/utils/normalize-name";
import type { decodeSearchManifest } from "@/lib/search/manifest";
import { searchIdentityOptions, searchManifestOptions } from "@/lib/search/query";
import { preloadHoverImage } from "@/components/ui/hover-preview-provider";
import { stationHref } from "@/lib/entity-routes";
import { toTarkovJsonGameMode } from "@/lib/game-mode";
import { hideoutPageQueryOptions } from "@/lib/query/page-data";
import { useUserStore } from "@/lib/stores/useUserStore";
import type { HideoutPageData } from "@/types/contracts";
import type { Station } from "@/types/hideout";
import { EntityPreview } from "./entity-preview";
import { StationImage } from "./station-image";
import { ItemThumbnail } from "./item-thumbnail";

type LinkProps = Omit<ComponentProps<typeof Link>, "href" | "children">;

/**
 * Link to `/hideout/stations/[stationId]` with a hover/focus preview built from the
 * supplied station or the cached Hideout payload, plus the saved station level.
 */
export function StationLink({
	station,
	children,
	preview = true,
	className,
	...props
}: LinkProps & {
	station: Pick<Station, "id" | "name"> & Partial<Station>;
	children?: ReactNode;
	preview?: boolean;
}) {
	const client = useQueryClient();
	const mode = toTarkovJsonGameMode(useUserStore((state) => state.gameMode));
	return (
		<EntityPreview
			disabled={!preview}
			prepare={() => {
				const cached = client
					.getQueryData<HideoutPageData>(hideoutPageQueryOptions(mode).queryKey)
					?.stations?.find((entry) => entry.id === station.id);
				return preloadHoverImage(station.imageLink ?? cached?.imageLink);
			}}
			renderPreview={() => <StationPreviewCard station={station} />}
		>
			{(triggerProps) => (
				<Link {...props} {...triggerProps} href={stationHref(station.id)} className={className}>
					{children ?? station.name}
				</Link>
			)}
		</EntityPreview>
	);
}

function StationPreviewCard({ station: supplied }: { station: Pick<Station, "id" | "name"> & Partial<Station> }) {
	const client = useQueryClient();
	const mode = toTarkovJsonGameMode(useUserStore((state) => state.gameMode));
	const state = useUserStore(
		useShallow((state) => ({
			stationLevels: state.stationLevels,
			itemCounts: state.itemCounts,
			completedRequirements: state.completedRequirements,
			traderLoyaltyLevels: state.questTraderLoyaltyLevels,
		})),
	);
	const currentLevel = state.stationLevels[supplied.id] ?? 0;
	const cachedPage = useQuery({ ...hideoutPageQueryOptions(mode), enabled: false }).data;
	const cached = cachedPage?.stations?.find((entry) => entry.id === supplied.id);
	const station = { ...cached, ...supplied, levels: supplied.levels ?? cached?.levels };
	const maxLevel = station.levels?.length ? Math.max(...station.levels.map((level) => level.level)) : null;
	const releaseId = client.getQueryData<{ releaseId: string }>(searchIdentityOptions(mode).queryKey)?.releaseId;
	const manifest = releaseId
		? client.getQueryData<ReturnType<typeof decodeSearchManifest>>(searchManifestOptions(mode, releaseId).queryKey)
		: undefined;
	const stations =
		cachedPage?.stations ??
		(station.levels
			? [{ ...station, normalizedName: station.normalizedName ?? station.id, levels: station.levels }]
			: []);
	const upgrade = getStationPreviewUpgrade({
		station,
		stations,
		stationLevels: state.stationLevels,
		itemById: Object.fromEntries(
			[...(manifest?.items ?? []), ...(cachedPage?.items ?? [])].map((item) => [item.id, item]),
		),
		itemCounts: state.itemCounts,
		completedRequirements: state.completedRequirements,
		traderLevelsByName: Object.fromEntries(
			Object.entries(manifest?.traders ?? {}).map(([id, trader]) => [
				normalizeName(trader.name),
				state.traderLoyaltyLevels[id] ?? 1,
			]),
		),
	});

	return (
		<div>
			<div className="flex items-center gap-2">
				<StationImage
					station={{
						name: station.name,
						normalizedName: station.normalizedName ?? station.id,
						imageLink: station.imageLink,
					}}
					size={36}
				/>
				<div className="min-w-0">
					<p className="text-xs font-semibold text-foreground">{station.name}</p>
					<p className="font-mono text-[11px] text-muted-foreground">
						Your level <span className={currentLevel > 0 ? "text-brand" : undefined}>{currentLevel}</span>
						{maxLevel != null && ` / ${maxLevel}`}
					</p>
				</div>
			</div>
			{upgrade.status === "maxed" ? (
				<p className="mt-2 text-xs text-success">Fully upgraded</p>
			) : upgrade.status === "unavailable" ? (
				<p className="mt-2 text-xs text-muted-foreground">Upgrade requirements unavailable</p>
			) : (
				<div className="mt-2 border-t border-highlight/10 pt-2">
					<p className="mb-1 text-[11px] font-semibold text-foreground/75">
						{upgrade.rows.length ? "Needed" : "Requirements covered"} for level {upgrade.level}
					</p>
					<ul className="space-y-1 text-xs">
						{upgrade.rows.slice(0, 5).map((row) => (
							<li key={row.id} className="flex items-start gap-1.5">
								{row.item && <ItemThumbnail item={row.item} size={18} />}
								<span className="min-w-0 leading-4">
									{row.count != null && <span className="mr-1 font-mono">{row.count.toLocaleString()} ×</span>}
									{row.name}
									{row.level != null && (
										<span className="ml-1 font-mono text-warning">
											{row.kind === "trader" ? "LL" : "LVL "}
											{row.level}
										</span>
									)}
									{row.isFir && <span className="ml-1 text-fir">FiR</span>}
									{row.unresolved && <span className="ml-1 text-warning">· data unavailable</span>}
									{row.untracked && <span className="ml-1 text-muted-foreground">· untracked</span>}
								</span>
							</li>
						))}
						{upgrade.rows.length > 5 && (
							<li className="text-muted-foreground">+{upgrade.rows.length - 5} more requirements</li>
						)}
					</ul>
				</div>
			)}
		</div>
	);
}

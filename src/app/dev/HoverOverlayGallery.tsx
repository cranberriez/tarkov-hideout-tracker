"use client";

import { useQuery } from "@tanstack/react-query";
import { ItemLink } from "@/components/entities/item-link";
import { ItemThumbnail } from "@/components/entities/item-thumbnail";
import { QuestLink } from "@/components/entities/quest-link";
import { StationLink } from "@/components/entities/station-link";
import { toTarkovJsonGameMode } from "@/lib/game-mode";
import { useGameDataEnabled } from "@/lib/query/game-data";
import { hideoutPageQueryOptions, questWorkspacePageQueryOptions } from "@/lib/query/page-data";
import { useUserStore } from "@/lib/stores/useUserStore";
import type { ItemSummary } from "@/types/items";

const samples: Array<{ item: ItemSummary; label: string }> = [
	{
		item: {
			id: "544fb45d4bdc2dee738b4568",
			name: "Salewa first aid kit",
			normalizedName: "salewa-first-aid-kit",
			marketPrice: { price: 32000, changeLast48hPercent: 12.34 },
		},
		label: "Rising price",
	},
	{
		item: {
			id: "57347ca924597744596b4e71",
			name: "Graphics card",
			normalizedName: "graphics-card",
			marketPrice: { price: 580000, changeLast48hPercent: -8.76 },
		},
		label: "Falling price",
	},
	{
		item: {
			id: "590c621186f774138d11ea29",
			name: "Secure Flash drive",
			normalizedName: "secure-flash-drive",
			marketPrice: { price: 48000, changeLast48hPercent: 0, fleaStability: "unstable" },
		},
		label: "Flat / unstable price",
	},
	{
		item: { id: "59e36c6f86f774176c10a2a7", name: "Power cord", normalizedName: "power-cord", priceLoadState: "error" },
		label: "Price unavailable",
	},
	{
		item: {
			id: "59faff1d86f7746c51718c9c",
			name: "Physical Bitcoin",
			normalizedName: "physical-bitcoin",
			onFleaMarket: false,
			marketPrice: {
				sellFor: [
					{ traderId: "54cb57776803fa99248b456e", priceRUB: 500000 },
					{ traderId: "579dc571d53a0658a154fbec", priceRUB: 300000 },
				],
			},
		},
		label: "Flea banned · best trader (sample)",
	},
	{
		item: {
			id: "57347ca924597744596b4e71",
			name: "Graphics card (zero price)",
			normalizedName: "graphics-card",
			onFleaMarket: true,
			marketPrice: { price: 0 },
		},
		label: "Zero price · hidden",
	},
];
const triggerClass =
	"flex items-center gap-2 rounded-md border border-border bg-background/40 px-3 py-2 text-sm hover:border-brand/40 focus-visible:outline-2 focus-visible:outline-brand";

export function HoverOverlayGallery() {
	const mode = toTarkovJsonGameMode(useUserStore((state) => state.gameMode));
	const enabled = useGameDataEnabled(mode);
	const quests = useQuery({ ...questWorkspacePageQueryOptions(mode), enabled });
	const hideout = useQuery({ ...hideoutPageQueryOptions(mode), enabled });
	const questExamples = (quests.data?.quests ?? []).slice(0, 3);
	const stationExamples = (hideout.data?.stations ?? []).filter((station) =>
		["medstation", "workbench", "generator"].includes(station.normalizedName),
	);
	return (
		<section aria-labelledby="hover-overlay-gallery" className="space-y-4 rounded-xl border border-border bg-card p-5">
			<header className="space-y-1">
				<h2 id="hover-overlay-gallery" className="text-xl font-semibold">
					Hover overlays
				</h2>
				<p className="text-sm text-muted-foreground">
					Hover or focus an example. Item prices below are samples; inventory, demand, quests, and station levels follow
					your active profile.
				</p>
			</header>
			<div className="flex flex-wrap gap-3">
				{samples.map(({ item, label }) => {
					const previewItem = { ...item, iconLink: `https://assets.tarkov.dev/${item.id}-icon.webp` };
					return (
						<div key={label} className="space-y-1">
							<ItemLink item={previewItem} className={triggerClass}>
								<ItemThumbnail item={previewItem} size={32} />
								{item.name}
							</ItemLink>
							<p className="px-1 text-[11px] text-muted-foreground">{label}</p>
						</div>
					);
				})}
			</div>
			<div className="grid gap-4 sm:grid-cols-2">
				<div className="space-y-2">
					<h3 className="text-sm font-semibold">Quests</h3>
					<div className="flex flex-wrap gap-2">
						{questExamples.map((quest) => (
							<QuestLink key={quest.id} questId={quest.id} quest={quest} className={triggerClass} />
						))}
					</div>
					{quests.isPending && <p className="text-xs text-muted-foreground">Loading quest examples…</p>}
					{quests.isError && (
						<p role="alert" className="text-xs text-danger">
							Quest examples unavailable.
						</p>
					)}
					{quests.isSuccess && !questExamples.length && (
						<p className="text-xs text-muted-foreground">No quests in this mode.</p>
					)}
				</div>
				<div className="space-y-2">
					<h3 className="text-sm font-semibold">Stations</h3>
					<div className="flex flex-wrap gap-2">
						{stationExamples.map((station) => (
							<StationLink key={station.id} station={station} className={triggerClass} />
						))}
					</div>
					{hideout.isPending && <p className="text-xs text-muted-foreground">Loading station examples…</p>}
					{hideout.isError && (
						<p role="alert" className="text-xs text-danger">
							Station examples unavailable.
						</p>
					)}
					{hideout.isSuccess && !stationExamples.length && (
						<p className="text-xs text-muted-foreground">No matching stations in this mode.</p>
					)}
				</div>
			</div>
		</section>
	);
}

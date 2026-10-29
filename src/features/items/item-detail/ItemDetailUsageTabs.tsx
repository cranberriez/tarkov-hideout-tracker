"use client";

import { useState, type ReactNode } from "react";
import { Activity, ChartNoAxesCombined, ClipboardList, Hammer, ShoppingCart, Wrench } from "lucide-react";
import type { DerivedQuestAnyOfGroup, DerivedQuestItemState, QuestRewardLink } from "@/lib/quests/quest-item-index";
import { ItemDetailHideoutRequirements, type StationRequirementEntry } from "./ItemDetailHideoutRequirements";
import { ItemDetailQuestRequirements } from "./ItemDetailQuestRequirements";
import { ItemDetailAcquisition } from "./ItemDetailAcquisition";
import { ItemDetailCrafting } from "./ItemDetailCrafting";
import { ItemDetailPriceHistory } from "./ItemDetailPriceHistory";
import { ItemDetailMarketAnalytics } from "./ItemDetailMarketAnalytics";
import { getCachedPriceHistoryAvailability } from "./price-history-query";
import type { ItemCraftRecipe, ItemTraderOffer } from "@/features/items/item-detail/item-detail-types";
import type { ItemSummary } from "@/types/items";
import type { GameEdition } from "@/lib/stores/useUserStore";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import type { ManualPriceOverrides, RecipeEvaluation } from "@/lib/price-calculation";
import { useQueryClient } from "@tanstack/react-query";

export type UsageTab = "hideout" | "quests" | "traders" | "crafting" | "prices" | "analytics";

interface ItemDetailUsageTabsProps {
	activeTab?: UsageTab;
	onTabChange?: (tab: UsageTab) => void;
	usageLoaded?: boolean;
	className?: string;
	/** Desktop dialogs cap and scroll the panel; smaller dialogs and pages let it flow. */
	contained?: boolean;
	selectedItemId: string;
	selectedItemImageLink?: string;
	stationRequirements: [string, StationRequirementEntry[]][];
	stationLevels: Record<string, number>;
	hiddenStations: Record<string, boolean>;
	questItemState: DerivedQuestItemState | null;
	questRewards: QuestRewardLink[];
	anyOfGroups: DerivedQuestAnyOfGroup[];
	itemDetailsById: Record<string, ItemSummary>;
	traderOffers: ItemTraderOffer[];
	crafts: ItemCraftRecipe[];
	/** Recipes that consume the item, listed below the ones that produce it. */
	usedInBarters: ItemTraderOffer[];
	usedInCrafts: ItemCraftRecipe[];
	relationsLoading: boolean;
	relationsError: string | null;
	onRetryRelations: () => void;
	acquisitionLoading: boolean;
	barterError: string | null;
	craftError: string | null;
	onRetryAcquisition: () => void;
	acquisitionWarning: string | null;
	/** False until the saved profile loads (and on the server): status indicators stay neutral. */
	profileReady: boolean;
	completedQuests: Record<string, boolean>;
	traderLoyaltyLevels: Record<string, number>;
	gameEdition: GameEdition | null;
	gameMode: TarkovJsonGameMode;
	showPriceHistory: boolean;
	barterEvaluationsById: Readonly<Record<string, RecipeEvaluation>>;
	craftEvaluationsById: Readonly<Record<string, RecipeEvaluation>>;
	overrides?: ManualPriceOverrides;
	profitLoading: boolean;
	profitError: string | null;
	onRetryProfit: () => void;
}

export function ItemDetailUsageTabs({
	activeTab = "hideout",
	onTabChange = () => {},
	usageLoaded = true,
	className = "",
	contained = true,
	selectedItemId,
	selectedItemImageLink,
	stationRequirements,
	stationLevels,
	hiddenStations,
	questItemState,
	questRewards,
	anyOfGroups,
	itemDetailsById,
	traderOffers,
	crafts,
	usedInBarters,
	usedInCrafts,
	relationsLoading,
	relationsError,
	onRetryRelations,
	acquisitionLoading,
	barterError,
	craftError,
	onRetryAcquisition,
	acquisitionWarning,
	profileReady,
	completedQuests,
	traderLoyaltyLevels,
	gameEdition,
	gameMode,
	showPriceHistory,
	barterEvaluationsById,
	craftEvaluationsById,
	overrides = {},
	profitLoading,
	profitError,
	onRetryProfit,
}: ItemDetailUsageTabsProps) {
	const queryClient = useQueryClient();
	const hideoutCount = stationRequirements.reduce((count, [, reqs]) => count + reqs.length, 0);
	const questCount = (questItemState?.relatedQuestCount ?? 0) + anyOfGroups.length + questRewards.length;
	const [hasLoadedPriceHistory, setHasLoadedPriceHistory] = useState<boolean | null>(() =>
		getCachedPriceHistoryAvailability(queryClient, selectedItemId, gameMode),
	);
	const traderCount = traderOffers.length + usedInBarters.length;
	const craftCount = crafts.length + usedInCrafts.length;
	const historyEnabled = showPriceHistory && hasLoadedPriceHistory !== false;
	const analyticsEnabled = showPriceHistory;
	const enabledTabs: UsageTab[] = [
		"hideout",
		"quests",
		"traders",
		"crafting",
		...(historyEnabled ? (["prices"] as const) : []),
		...(analyticsEnabled ? (["analytics"] as const) : []),
	];
	const selectedTab = enabledTabs.includes(activeTab) ? activeTab : enabledTabs[0];
	const selectedItem = itemDetailsById[selectedItemId] ?? {
		id: selectedItemId,
		name: "Selected item",
		normalizedName: selectedItemId,
		iconLink: selectedItemImageLink,
	};

	return (
		<section className={`flex min-h-0 min-w-0 flex-col bg-card/45 ${className}`}>
			<div className="flex h-10 shrink-0 items-stretch overflow-x-auto border-b border-border-color" role="tablist">
				<TabButton
					active={selectedTab === "hideout"}
					onClick={() => onTabChange("hideout")}
					label="Hideout"
					count={relationsLoading ? undefined : hideoutCount}
					icon={<Hammer size={13} />}
				/>
				<TabButton
					active={selectedTab === "quests"}
					onClick={() => onTabChange("quests")}
					label="Quests"
					count={relationsLoading ? undefined : questCount}
					icon={<ClipboardList size={13} />}
				/>
				<TabButton
					active={selectedTab === "traders"}
					onClick={() => onTabChange("traders")}
					label="Traders"
					count={!usageLoaded || acquisitionLoading ? undefined : traderCount}
					icon={<ShoppingCart size={13} />}
				/>
				<TabButton
					active={selectedTab === "crafting"}
					onClick={() => onTabChange("crafting")}
					label="Crafting"
					count={!usageLoaded || acquisitionLoading ? undefined : craftCount}
					icon={<Wrench size={13} />}
				/>
				<TabButton
					active={selectedTab === "prices"}
					disabled={!historyEnabled}
					onClick={() => onTabChange("prices")}
					label="History"
					icon={<ChartNoAxesCombined size={13} />}
				/>
				<TabButton
					active={selectedTab === "analytics"}
					disabled={!analyticsEnabled}
					onClick={() => onTabChange("analytics")}
					label="Analytics"
					icon={<Activity size={13} />}
				/>
			</div>

			<div
				role="tabpanel"
				className={
					contained ? "flex flex-col lg:min-h-0 lg:max-h-[700px] lg:flex-1 lg:overflow-y-auto" : "flex flex-1 flex-col"
				}
			>
				<UsagePanel active={selectedTab === "hideout"}>
					<>
						{!relationsLoading && !relationsError && hideoutCount === 0 && (
							<p className="px-4 py-6 text-sm text-muted-foreground">No hideout requirements.</p>
						)}
						{(relationsLoading || relationsError) && (
							<RelationState
								loading={relationsLoading}
								error={relationsError}
								loadingMessage="Loading hideout data…"
								onRetry={onRetryRelations}
							/>
						)}
						{hideoutCount > 0 && (
							<ItemDetailHideoutRequirements
								selectedItemImageLink={selectedItemImageLink}
								stationRequirements={stationRequirements}
								profileReady={profileReady}
								stationLevels={stationLevels}
								hiddenStations={hiddenStations}
							/>
						)}
					</>
				</UsagePanel>
				<UsagePanel active={selectedTab === "quests"}>
					<>
						{!relationsLoading && !relationsError && questCount === 0 && (
							<p className="px-4 py-6 text-sm text-muted-foreground">No matching quest requirements or rewards.</p>
						)}
						{(relationsLoading || relationsError) && (
							<RelationState
								loading={relationsLoading}
								error={relationsError}
								loadingMessage="Loading quest data…"
								onRetry={onRetryRelations}
							/>
						)}
						{questCount > 0 && (
							<ItemDetailQuestRequirements
								selectedItemId={selectedItemId}
								selectedItemImageLink={selectedItemImageLink}
								questItemState={questItemState}
								questRewards={questRewards}
								anyOfGroups={anyOfGroups}
								itemDetailsById={itemDetailsById}
								completedQuests={completedQuests}
							/>
						)}
					</>
				</UsagePanel>
				<UsagePanel active={selectedTab === "traders"}>
					<AcquisitionState
						loading={acquisitionLoading}
						error={barterError}
						warning={acquisitionWarning}
						empty={traderCount === 0}
						onRetry={onRetryAcquisition}
					>
						<RecipeSection title="Trader offers" tone="produce" show={traderOffers.length > 0}>
							<ItemDetailAcquisition
								offers={traderOffers}
								profileReady={profileReady}
								completedQuests={completedQuests}
								traderLoyaltyLevels={traderLoyaltyLevels}
								overrides={overrides}
								evaluationsById={barterEvaluationsById}
								profitLoading={profitLoading}
								profitError={profitError}
								onRetryProfit={onRetryProfit}
								outputItem={selectedItem}
							/>
						</RecipeSection>
						<RecipeSection title="Used in barters" tone="consume" show={usedInBarters.length > 0}>
							<ItemDetailAcquisition
								offers={usedInBarters}
								profileReady={profileReady}
								completedQuests={completedQuests}
								traderLoyaltyLevels={traderLoyaltyLevels}
								evaluationsById={NO_EVALUATIONS}
								profitLoading={false}
								profitError={null}
								outputItem={selectedItem}
								usedIn
							/>
						</RecipeSection>
					</AcquisitionState>
				</UsagePanel>
				<UsagePanel active={selectedTab === "crafting"}>
					<AcquisitionState
						loading={acquisitionLoading}
						error={craftError}
						warning={acquisitionWarning}
						empty={craftCount === 0}
						onRetry={onRetryAcquisition}
					>
						<RecipeSection title="Crafts" tone="produce" show={crafts.length > 0}>
							<ItemDetailCrafting
								recipes={crafts}
								profileReady={profileReady}
								completedQuests={completedQuests}
								stationLevels={stationLevels}
								gameEdition={gameEdition}
								overrides={overrides}
								evaluationsById={craftEvaluationsById}
								profitLoading={profitLoading}
								profitError={profitError}
								onRetryProfit={onRetryProfit}
								outputItem={selectedItem}
							/>
						</RecipeSection>
						<RecipeSection title="Used in crafts" tone="consume" show={usedInCrafts.length > 0}>
							<ItemDetailCrafting
								recipes={usedInCrafts}
								profileReady={profileReady}
								completedQuests={completedQuests}
								stationLevels={stationLevels}
								gameEdition={gameEdition}
								evaluationsById={NO_EVALUATIONS}
								profitLoading={false}
								profitError={null}
								outputItem={selectedItem}
								usedIn
							/>
						</RecipeSection>
					</AcquisitionState>
				</UsagePanel>
				{selectedTab === "prices" && historyEnabled && (
					<ItemDetailPriceHistory
						itemId={selectedItemId}
						mode={gameMode}
						onAvailabilityChange={setHasLoadedPriceHistory}
					/>
				)}
				{selectedTab === "analytics" && analyticsEnabled && (
					<ItemDetailMarketAnalytics itemId={selectedItemId} mode={gameMode} item={itemDetailsById[selectedItemId]} />
				)}
			</div>
		</section>
	);
}

const NO_EVALUATIONS: Readonly<Record<string, RecipeEvaluation>> = {};

/** Green headings identify ways to obtain the item; neutral headings identify where it is consumed. */
function RecipeSection({
	title,
	tone,
	show,
	children,
}: {
	title: string;
	tone: "produce" | "consume";
	show: boolean;
	children: ReactNode;
}) {
	if (!show) return null;
	return (
		<section>
			<div
				className={`px-3 py-2 text-xs font-semibold ${
					tone === "produce" ? "bg-brand/10 text-brand" : "bg-border-color text-foreground"
				}`}
			>
				{title}
			</div>
			{children}
		</section>
	);
}

function UsagePanel({ active, children }: { active: boolean; children: ReactNode }) {
	return active ? <div className="contents">{children}</div> : null;
}

function AcquisitionState({
	loading,
	error,
	warning,
	empty,
	children,
	onRetry,
}: {
	loading: boolean;
	error: string | null;
	warning: string | null;
	empty: boolean;
	children: ReactNode;
	onRetry: () => void;
}) {
	if (loading) {
		return <p className="px-4 py-6 text-sm text-muted-foreground">Loading acquisition data…</p>;
	}
	if (error) {
		return <ErrorState message={error} onRetry={onRetry} />;
	}
	if (empty) {
		return (
			<div>
				{warning && <p className="px-4 pt-4 text-sm text-warning">{warning}</p>}
				<p className="px-4 py-6 text-sm text-muted-foreground">No matching records.</p>
			</div>
		);
	}
	return (
		<div>
			{warning && <p className="border-b border-border-color px-4 py-2 text-xs text-warning">{warning}</p>}
			{children}
		</div>
	);
}

function RelationState({
	loading,
	error,
	loadingMessage,
	onRetry,
}: {
	loading: boolean;
	error: string | null;
	loadingMessage: string;
	onRetry: () => void;
}) {
	if (error) return <ErrorState message={error} onRetry={onRetry} compact />;
	return (
		<p className={`border-b border-border-color px-4 py-2 text-xs ${"text-muted-foreground"}`}>
			{loading ? loadingMessage : null}
		</p>
	);
}

function ErrorState({
	message,
	onRetry,
	compact = false,
}: {
	message: string;
	onRetry: () => void;
	compact?: boolean;
}) {
	const actionLabel = message.startsWith("The data release changed") ? "Refresh page" : "Try again";
	return (
		<div
			className={`flex items-center justify-between gap-3 text-warning ${compact ? "border-b border-border-color px-4 py-2 text-xs" : "px-4 py-6 text-sm"}`}
		>
			<span>{message}</span>
			<button
				type="button"
				onClick={onRetry}
				className="shrink-0 rounded border border-warning/30 px-2 py-1 text-xs hover:bg-warning/10"
			>
				{actionLabel}
			</button>
		</div>
	);
}

function TabButton({
	active,
	disabled = false,
	onClick,
	label,
	count,
	icon,
}: {
	active: boolean;
	disabled?: boolean;
	onClick: () => void;
	label: string;
	count?: number;
	icon: ReactNode;
}) {
	return (
		<button
			type="button"
			role="tab"
			aria-selected={active}
			disabled={disabled}
			onClick={onClick}
			className={`relative flex min-w-28 items-center justify-center gap-2 border-r border-border-color px-4 text-xs transition-colors ${
				active
					? "bg-highlight/[0.04] text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-brand"
					: disabled
						? "cursor-not-allowed text-muted-foreground/35"
						: "text-muted-foreground hover:bg-highlight/[0.02] hover:text-foreground"
			}`}
		>
			{icon}
			{label}
			{count !== undefined && <span className="font-mono text-[10px] text-muted-foreground">{count}</span>}
		</button>
	);
}

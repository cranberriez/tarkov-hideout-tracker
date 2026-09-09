import { CraftingSettings } from "./CraftingSettings";
import Image from "next/image";
import { Pin, Users, Wrench } from "lucide-react";
import { FilterBar, FilterSearchInput, FilterToggle } from "@/components/ui/filter-bar";
import { FilterMultiSelect, FilterMultiSelectItem } from "@/components/ui/filter-multi-select";
import type { ProfitPageKind } from "../types";
import { CalculationSettings } from "./CalculationSettings";

interface SourceOption {
  id: string;
  name: string;
  imageLink?: string;
  level?: number;
}

import type { ProfitLockOptionsProps } from "../types";

export function ProfitPageControls({
  kind,
  craftingSkillLevel,
  craftingSkillForced,
  craftingSkillNote,
  onCraftingSkillLevelChange,
  hideoutManagementSkillLevel,
  onHideoutManagementSkillLevelChange,
  search,
  onSearchChange,
  traderSourceIds,
  onTraderSourceIdsChange,
  stationSourceIds,
  onStationSourceIdsChange,
  sources,
  availableOnly,
  onAvailableOnlyChange,
  lockFilters,
  onLockFiltersChange,
  useTraderSaleForLockedOutputs,
  onUseTraderSaleForLockedOutputsChange,
  profitableOnly,
  onProfitableOnlyChange,
  allowCrafts,
  onAllowCraftsChange,
  allowBarters,
  onAllowBartersChange,
  showPinnedOnly,
  onShowPinnedOnlyChange,
}: {
  kind: ProfitPageKind;
  craftingSkillLevel: number;
  craftingSkillForced: boolean;
  craftingSkillNote?: string;
  onCraftingSkillLevelChange: (value: number) => void;
  hideoutManagementSkillLevel: number;
  onHideoutManagementSkillLevelChange: (value: number) => void;
  search: string;
  onSearchChange: (value: string) => void;
  traderSourceIds: string[];
  onTraderSourceIdsChange: (value: string[]) => void;
  stationSourceIds: string[];
  onStationSourceIdsChange: (value: string[]) => void;
  sources: SourceOption[];
  availableOnly: boolean;
  onAvailableOnlyChange: (value: boolean) => void;
  profitableOnly: boolean;
  onProfitableOnlyChange: (value: boolean) => void;
  allowCrafts: boolean;
  onAllowCraftsChange: (value: boolean) => void;
  allowBarters: boolean;
  onAllowBartersChange: (value: boolean) => void;
  showPinnedOnly: boolean;
  onShowPinnedOnlyChange: (value: boolean) => void;
} & ProfitLockOptionsProps) {
  return (
    <FilterBar
      className="relative mb-4"
      aria-label={kind === "craft" ? "Craft profit filters" : "Barter profit filters"}
    >
      <FilterSearchInput
        value={search}
        onValueChange={onSearchChange}
        label="Search output item"
        placeholder="Search output item"
      />
      {kind === "craft" ? (
        <StationSourceSelect
          selectedSourceIds={stationSourceIds}
          onSelectedSourceIdsChange={onStationSourceIdsChange}
          sources={sources}
          availableOnly={availableOnly}
        />
      ) : (
        <TraderSourceSelect
          selectedSourceIds={traderSourceIds}
          onSelectedSourceIdsChange={onTraderSourceIdsChange}
          sources={sources}
        />
      )}
      {kind === "craft" && (
        <CraftingSettings
          forced={craftingSkillForced}
          note={craftingSkillNote}
          craftingLevel={craftingSkillLevel}
          onCraftingLevelChange={onCraftingSkillLevelChange}
          hideoutManagementLevel={hideoutManagementSkillLevel}
          onHideoutManagementLevelChange={onHideoutManagementSkillLevelChange}
        />
      )}
      <CalculationSettings
        lockFilters={lockFilters}
        onLockFiltersChange={onLockFiltersChange}
        useTraderSaleForLockedOutputs={useTraderSaleForLockedOutputs}
        onUseTraderSaleForLockedOutputsChange={onUseTraderSaleForLockedOutputsChange}
        availableOnly={availableOnly}
        onAvailableOnlyChange={onAvailableOnlyChange}
        profitableOnly={profitableOnly}
        onProfitableOnlyChange={onProfitableOnlyChange}
        allowCrafts={allowCrafts}
        onAllowCraftsChange={onAllowCraftsChange}
        allowBarters={allowBarters}
        onAllowBartersChange={onAllowBartersChange}
      />
      {kind === "craft" && (
        <FilterToggle
          checked={showPinnedOnly}
          onCheckedChange={onShowPinnedOnlyChange}
          aria-label="Show pinned crafts only"
          title={showPinnedOnly ? "Show all crafts" : "Show pinned crafts only"}
        >
          <Pin className={`size-3.5 ${showPinnedOnly ? "fill-current" : ""}`} />
          Pinned only
        </FilterToggle>
      )}
    </FilterBar>
  );
}

function StationSourceSelect({
  selectedSourceIds,
  onSelectedSourceIdsChange,
  sources,
  availableOnly,
}: {
  selectedSourceIds: string[];
  onSelectedSourceIdsChange: (value: string[]) => void;
  sources: SourceOption[];
  availableOnly: boolean;
}) {
  const selectedSources = sources.filter((source) => selectedSourceIds.includes(source.id));
  const selectedSource = selectedSources.length === 1 ? selectedSources[0] : undefined;
  const selectionLabel =
    selectedSources.length === 0
      ? "All stations"
      : selectedSources.length === 1
        ? selectedSources[0].name
        : `${selectedSources.length} stations`;

  return (
    <FilterMultiSelect
      label={`Filter by hideout station: ${selectionLabel}`}
      className="min-w-[180px]"
      summary={
        <>
          {selectedSource ? (
            <StationIcon source={selectedSource} />
          ) : (
            <Wrench className="size-5 shrink-0 text-muted-foreground" />
          )}
          <span className="min-w-0 flex-1 truncate text-left">{selectionLabel}</span>
          {(selectedSource?.level ?? 0) > 0 && (
            <span className="shrink-0 text-xs text-muted-foreground">
              Level {selectedSource?.level}
            </span>
          )}
        </>
      }
    >
      <FilterMultiSelectItem
        checked={selectedSourceIds.length === 0}
        onCheckedChange={() => onSelectedSourceIdsChange([])}
        className="gap-2"
      >
        <Wrench className="size-6 text-muted-foreground" />
        <span className="flex-1">All stations</span>
      </FilterMultiSelectItem>
      {sources.map((source) => {
        const built = (source.level ?? 0) > 0;
        const checked = selectedSourceIds.includes(source.id);
        return (
          <FilterMultiSelectItem
            key={source.id}
            checked={checked}
            disabled={availableOnly && !built}
            onCheckedChange={() =>
              onSelectedSourceIdsChange(
                checked
                  ? selectedSourceIds.filter((id) => id !== source.id)
                  : [...selectedSourceIds, source.id],
              )
            }
            className="gap-2"
            title={!built ? "Station not built" : undefined}
          >
            <StationIcon source={source} />
            <span className="min-w-0 flex-1 truncate">{source.name}</span>
            {built && (
              <span className="ml-4 shrink-0 text-xs text-muted-foreground">
                Level {source.level}
              </span>
            )}
          </FilterMultiSelectItem>
        );
      })}
    </FilterMultiSelect>
  );
}

function StationIcon({ source }: { source: SourceOption }) {
  return source.imageLink ? (
    <Image
      src={source.imageLink}
      alt=""
      width={24}
      height={24}
      className="size-6 shrink-0 rounded object-contain"
      unoptimized
    />
  ) : (
    <Wrench className="size-6 shrink-0 text-muted-foreground" />
  );
}

function TraderSourceSelect({
  selectedSourceIds,
  onSelectedSourceIdsChange,
  sources,
}: {
  selectedSourceIds: string[];
  onSelectedSourceIdsChange: (value: string[]) => void;
  sources: SourceOption[];
}) {
  const selectedSources = sources.filter((source) => selectedSourceIds.includes(source.id));
  const selectedSource = selectedSources.length === 1 ? selectedSources[0] : undefined;
  const selectionLabel =
    selectedSources.length === 0
      ? "All traders"
      : selectedSource
        ? selectedSource.name
        : `${selectedSources.length} traders`;
  return (
    <FilterMultiSelect
      label={`Filter by trader: ${selectionLabel}`}
      className="min-w-[180px]"
      summary={
        <>
          {selectedSource ? (
            <TraderIcon source={selectedSource} />
          ) : (
            <Users className="size-5 shrink-0 text-muted-foreground" />
          )}
          <span className="min-w-0 flex-1 truncate text-left">{selectionLabel}</span>
        </>
      }
    >
      <FilterMultiSelectItem
        checked={selectedSourceIds.length === 0}
        onCheckedChange={() => onSelectedSourceIdsChange([])}
      >
        <Users className="size-6 text-muted-foreground" />
        <span className="flex-1">All traders</span>
      </FilterMultiSelectItem>
      {sources.map((source) => {
        const checked = selectedSourceIds.includes(source.id);
        return (
          <FilterMultiSelectItem
            key={source.id}
            checked={checked}
            onCheckedChange={() =>
              onSelectedSourceIdsChange(
                checked
                  ? selectedSourceIds.filter((id) => id !== source.id)
                  : [...selectedSourceIds, source.id],
              )
            }
          >
            <TraderIcon source={source} />
            <span className="min-w-0 flex-1 truncate">{source.name}</span>
          </FilterMultiSelectItem>
        );
      })}
    </FilterMultiSelect>
  );
}

function TraderIcon({ source }: { source: SourceOption }) {
  return source.imageLink ? (
    <Image
      src={source.imageLink}
      alt=""
      width={24}
      height={24}
      className="size-6 shrink-0 rounded object-contain"
      unoptimized
    />
  ) : (
    <Users className="size-6 shrink-0 text-muted-foreground" />
  );
}

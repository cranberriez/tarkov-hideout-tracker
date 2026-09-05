import Image from "next/image";
import { ChevronDown, Pin, Search, Wrench } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ProfitPageKind } from "../types";
import { CalculationSettings } from "./CalculationSettings";

interface SourceOption {
  id: string;
  name: string;
  imageLink?: string;
  level?: number;
}

export function ProfitPageControls({
  kind,
  search,
  onSearchChange,
  sourceId,
  onSourceIdChange,
  stationSourceIds,
  onStationSourceIdsChange,
  sources,
  availableOnly,
  onAvailableOnlyChange,
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
  search: string;
  onSearchChange: (value: string) => void;
  sourceId: string;
  onSourceIdChange: (value: string) => void;
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
}) {
  return (
    <section className="mb-4 rounded-md border border-white/10 bg-card/70 p-3 shadow-lg">
      <div
        className={`grid gap-3 ${kind === "craft" ? "lg:grid-cols-[minmax(220px,1fr)_220px_auto_auto]" : "lg:grid-cols-[minmax(220px,1fr)_220px_auto]"}`}
      >
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search output item"
            className="h-9 w-full rounded border border-white/10 bg-[#0b0c0e] pl-9 pr-3 text-sm outline-none focus:border-tarkov-green/60"
          />
        </label>
        {kind === "craft" ? (
          <StationSourceSelect
            selectedSourceIds={stationSourceIds}
            onSelectedSourceIdsChange={onStationSourceIdsChange}
            sources={sources}
            availableOnly={availableOnly}
          />
        ) : (
          <select
            value={sourceId}
            onChange={(event) => onSourceIdChange(event.target.value)}
            className="h-9 rounded border border-white/10 bg-[#0b0c0e] px-3 text-sm text-foreground [color-scheme:dark]"
          >
            <option className="bg-[#0b0c0e] text-foreground" value="all">
              All traders
            </option>
            {sources.map((source) => (
              <option
                className="bg-[#0b0c0e] text-foreground"
                key={source.id}
                value={source.id}
              >
                {source.name}
              </option>
            ))}
          </select>
        )}
        <CalculationSettings
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
          <button
            type="button"
            aria-pressed={showPinnedOnly}
            aria-label="Show pinned crafts only"
            title={
              showPinnedOnly ? "Show all crafts" : "Show pinned crafts only"
            }
            onClick={() => onShowPinnedOnlyChange(!showPinnedOnly)}
            className={`flex h-9 items-center justify-center rounded border bg-[#0b0c0e] px-3 transition ${showPinnedOnly ? "border-sky-400/40 text-sky-300" : "border-white/10 text-muted-foreground hover:border-sky-400/30 hover:text-sky-300"}`}
          >
            <Pin className={`size-4 ${showPinnedOnly ? "fill-current" : ""}`} />
          </button>
        )}
      </div>
    </section>
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
  const selectedSources = sources.filter((source) =>
    selectedSourceIds.includes(source.id),
  );
  const selectedSource =
    selectedSources.length === 1 ? selectedSources[0] : undefined;
  const selectionLabel =
    selectedSources.length === 0
      ? "All stations"
      : selectedSources.length === 1
        ? selectedSources[0].name
        : `${selectedSources.length} stations`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-9 min-w-0 items-center gap-2 rounded border border-white/10 bg-[#0b0c0e] px-2.5 text-sm text-foreground outline-none transition hover:border-white/20 focus-visible:border-tarkov-green/60"
          aria-label={`Filter by hideout station: ${selectionLabel}`}
        >
          {selectedSource ? (
            <StationIcon source={selectedSource} />
          ) : (
            <Wrench className="size-5 shrink-0 text-muted-foreground" />
          )}
          <span className="min-w-0 flex-1 truncate text-left">
            {selectionLabel}
          </span>
          {(selectedSource?.level ?? 0) > 0 && (
            <span className="shrink-0 text-xs text-muted-foreground">
              Level {selectedSource?.level}
            </span>
          )}
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={4}
        className="min-w-[var(--radix-dropdown-menu-trigger-width)] bg-[#0b0c0e]"
      >
        <DropdownMenuCheckboxItem
          checked={selectedSourceIds.length === 0}
          onSelect={(event) => event.preventDefault()}
          onCheckedChange={() => onSelectedSourceIdsChange([])}
          className="gap-2"
        >
          <Wrench className="size-6 text-muted-foreground" />
          <span className="flex-1">All stations</span>
        </DropdownMenuCheckboxItem>
        {sources.map((source) => {
          const built = (source.level ?? 0) > 0;
          const checked = selectedSourceIds.includes(source.id);
          return (
            <DropdownMenuCheckboxItem
              key={source.id}
              checked={checked}
              disabled={availableOnly && !built}
              onSelect={(event) => event.preventDefault()}
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
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
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

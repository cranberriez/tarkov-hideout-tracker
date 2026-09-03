import { Pin, Search } from "lucide-react";
import type { ProfitPageKind, SortMode } from "../types";
import { CalculationSettings } from "./CalculationSettings";

interface SourceOption {
  id: string;
  name: string;
}

export function ProfitPageControls({
  kind,
  search,
  onSearchChange,
  sourceId,
  onSourceIdChange,
  sources,
  sortMode,
  onSortModeChange,
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
  sources: SourceOption[];
  sortMode: SortMode;
  onSortModeChange: (value: SortMode) => void;
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
        className={`grid gap-3 ${kind === "craft" ? "lg:grid-cols-[minmax(220px,1fr)_220px_180px_auto_auto]" : "lg:grid-cols-[minmax(220px,1fr)_220px_180px_auto]"}`}
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
        <select
          value={sourceId}
          onChange={(event) => onSourceIdChange(event.target.value)}
          className="h-9 rounded border border-white/10 bg-[#0b0c0e] px-3 text-sm text-foreground [color-scheme:dark]"
        >
          <option className="bg-[#0b0c0e] text-foreground" value="all">
            All {kind === "barter" ? "traders" : "stations"}
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
        <select
          value={sortMode}
          onChange={(event) => onSortModeChange(event.target.value as SortMode)}
          className="h-9 rounded border border-white/10 bg-[#0b0c0e] px-3 text-sm text-foreground [color-scheme:dark]"
        >
          <option className="bg-[#0b0c0e] text-foreground" value="profit">
            Profit
          </option>
          <option
            className="bg-[#0b0c0e] text-foreground"
            value="profitPerHour"
          >
            Profit / hour
          </option>
          <option className="bg-[#0b0c0e] text-foreground" value="cost">
            Lowest cost
          </option>
          <option className="bg-[#0b0c0e] text-foreground" value="name">
            Item name
          </option>
        </select>
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

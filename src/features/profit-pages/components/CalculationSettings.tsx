import { useId, useRef, useState } from "react";
import { FilterPanel, FilterPanelButton, FilterSection } from "@/components/ui/filter-bar";
import { FilterCheckbox } from "@/components/ui/FilterCheckbox";
import { Settings2 } from "lucide-react";

import type { ProfitLockOptionsProps } from "../types";

export function CalculationSettings({
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
}: {
  availableOnly: boolean;
  onAvailableOnlyChange: (value: boolean) => void;
  profitableOnly: boolean;
  onProfitableOnlyChange: (value: boolean) => void;
  allowCrafts: boolean;
  onAllowCraftsChange: (value: boolean) => void;
  allowBarters: boolean;
  onAllowBartersChange: (value: boolean) => void;
} & ProfitLockOptionsProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <>
      <FilterPanelButton ref={trigger} open={open} panelId={panelId} onClick={() => setOpen(!open)}>
        <Settings2 className="size-3.5" /> Options
      </FilterPanelButton>
      <FilterPanel
        id={panelId}
        open={open}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            trigger.current?.focus();
          }
        }}
        className="left-auto right-0 top-full mt-2 max-h-[min(26rem,55dvh)] w-80 max-w-full overflow-y-auto overscroll-contain rounded-md border bg-muted p-4 shadow-2xl"
      >
        <FilterSection title="List filters">
          <Toggle
            checked={profitableOnly}
            onChange={onProfitableOnlyChange}
            label="Profitable recipes only"
          />
        </FilterSection>
        <FilterSection title="Availability">
          <Toggle
            checked={availableOnly}
            onChange={onAvailableOnlyChange}
            label="Hide locked recipes"
          />
          <div className="ml-3 border-l border-white/10 pl-2">
            {(
              [
                ["flea", "Hide no flea sale"],
                ["quest", "Hide quest locked"],
                ["vendor", "Hide vendor locked"],
                ["station", "Hide station locked"],
              ] as const
            ).map(([key, label]) => (
              <Toggle
                key={key}
                checked={lockFilters[key]}
                onChange={(value) => onLockFiltersChange({ ...lockFilters, [key]: value })}
                label={label}
              />
            ))}
          </div>
        </FilterSection>
        <FilterSection title="Output valuation">
          <Toggle
            checked={useTraderSaleForLockedOutputs}
            onChange={onUseTraderSaleForLockedOutputsChange}
            label="Use vendor sale for locked outputs"
          />
        </FilterSection>
        <FilterSection title="Ingredient sources">
          <Toggle
            checked={allowCrafts}
            onChange={onAllowCraftsChange}
            label="Use crafts for ingredients"
          />
          <Toggle
            checked={allowBarters}
            onChange={onAllowBartersChange}
            label="Use barters for ingredients"
          />
          <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
            The recipe being evaluated remains visible; these options only change how its required
            items are acquired.
          </p>
        </FilterSection>
      </FilterPanel>
    </>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  const id = useId();
  return <FilterCheckbox id={id} checked={checked} onCheckedChange={onChange} label={label} />;
}

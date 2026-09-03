import { Settings2 } from "lucide-react";

export function CalculationSettings({
  availableOnly,
  onAvailableOnlyChange,
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
}) {
  return (
    <details className="group/settings relative">
      <summary className="flex h-9 cursor-pointer list-none items-center justify-center gap-2 rounded border border-white/10 bg-[#0b0c0e] px-3 text-xs font-semibold text-muted-foreground hover:border-white/20 hover:text-foreground">
        <Settings2 className="size-4" />
        Options
      </summary>
      <div className="absolute right-0 top-11 z-50 w-72 rounded-md border border-white/15 bg-[#0b0c0e] p-3 shadow-2xl">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          List filters
        </p>
        <Toggle
          checked={availableOnly}
          onChange={onAvailableOnlyChange}
          label="Available to me"
        />
        <Toggle
          checked={profitableOnly}
          onChange={onProfitableOnlyChange}
          label="Profitable recipes only"
        />
        <p className="mb-2 mt-3 border-t border-white/10 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Ingredient routes
        </p>
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
          The recipe being evaluated remains visible; these options only change
          how its required items are acquired.
        </p>
      </div>
    </details>
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
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs text-foreground hover:bg-white/5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="accent-tarkov-green"
      />
      {label}
    </label>
  );
}

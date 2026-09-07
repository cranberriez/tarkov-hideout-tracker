import type { AcquisitionPlan } from "@/lib/price-calculation/types";
import { formatRoundedRoubles } from "../utils/formatters";

/** Use the evaluated route cost, including manual overrides and batch quantities. */
export function CraftFleaPrice({ part }: { part: AcquisitionPlan }) {
  if (part.method !== "flea" || part.isTool) return null;
  const unitPrice = part.totalCost !== null && part.quantity > 0 ? part.totalCost / part.quantity : null;
  return <span className="mt-1 block text-[11px] font-normal text-muted-foreground">
    <span className="font-mono">{formatRoundedRoubles(unitPrice)}</span> each
    {part.quantity !== 1 && <> · <span className="font-mono">{formatRoundedRoubles(part.totalCost)}</span> total</>}
  </span>;
}

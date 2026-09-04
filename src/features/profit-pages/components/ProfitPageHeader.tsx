import type { RecipeEvaluation } from "@/lib/price-calculation";
import type { ProfitPageKind } from "../types";
import { formatRoundedRoubles } from "../utils/formatters";

export function ProfitPageHeader({
  kind,
  gameMode,
  evaluations,
}: {
  kind: ProfitPageKind;
  gameMode: string;
  evaluations: RecipeEvaluation[];
}) {
  const totalProfit = evaluations.reduce(
    (total, evaluation) => total + Math.max(0, evaluation.profit ?? 0),
    0,
  );
  return (
    <header className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-tarkov-green">
          Average 24-hour market prices
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">
          {kind === "barter" ? "BARTER PROFITS" : "CRAFTING PROFITS"}
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Ingredient costs follow the cheapest practical mix of flea and trader
          purchases, crafts, and barters. Manual prices override market data for this{" "}
          {gameMode} profile.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
        <Stat label="Recipes" value={evaluations.length.toLocaleString()} />
        <Stat
          label="Profitable"
          value={evaluations
            .filter((entry) => (entry.profit ?? 0) > 0)
            .length.toLocaleString()}
        />
        <Stat
          label="Positive value"
          value={formatRoundedRoubles(totalProfit)}
        />
      </div>
    </header>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-white/10 bg-black/25 px-3 py-2">
      <div className="text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-mono font-semibold text-foreground">
        {value}
      </div>
    </div>
  );
}

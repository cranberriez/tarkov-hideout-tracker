import {
  LockKeyhole,
  ChartNoAxesCombined,
  ChevronDown,
  CircleArrowRight,
  Coins,
  UserRound,
  Wrench,
} from "lucide-react";
import type { RouteMethod } from "../types";

function routeIconClasses(
  method: Exclude<RouteMethod, "unavailable">,
  changedFromBase: boolean,
  filled: boolean,
  automaticFallback: boolean,
) {
  const styles = {
    barter: {
      color: "text-acquisition-barter",
      background: "bg-acquisition-barter",
      border: "border-acquisition-barter",
    },
    craft: {
      color: "text-acquisition-craft",
      background: "bg-acquisition-craft",
      border: "border-acquisition-craft",
    },
    trader: {
      color: "text-acquisition-trader",
      background: "bg-acquisition-trader",
      border: "border-acquisition-trader",
    },
    flea: {
      color: "text-acquisition-flea",
      background: "bg-acquisition-flea",
      border: "border-acquisition-flea",
    },
    sell: {
      color: "text-acquisition-sell-value",
      background: "bg-acquisition-sell-value",
      border: "border-acquisition-sell-value",
    },
  }[method];

  if (filled) return `${styles.background} text-inverse`;

  const border = changedFromBase
    ? `border-2 border-solid ${styles.border}`
    : automaticFallback
      ? `border-2 border-dashed ${styles.border}`
      : "";
  return `bg-transparent ${styles.color} ${border}`;
}

export function RouteIcon({
  method,
  inline = false,
  rowRail = false,
  preview = false,
  filled = false,
  switchable = false,
  changedFromBase = false,
  automaticFallback = false,
  title,
}: {
  method: RouteMethod;
  inline?: boolean;
  rowRail?: boolean;
  preview?: boolean;
  filled?: boolean;
  switchable?: boolean;
  changedFromBase?: boolean;
  automaticFallback?: boolean;
  title?: string;
}) {
  const classes = `${rowRail ? "relative h-full w-8 shrink-0 self-stretch rounded-none" : preview ? "relative size-7 shrink-0 rounded shadow-md" : inline ? "relative size-[18px] shrink-0 rounded-[3px] shadow-md" : "absolute -left-1 -top-1 z-10 size-[18px] rounded-[3px] shadow-md"} flex items-center justify-center`;
  const iconClasses = preview ? "size-4 stroke-[3]" : "size-3.5 stroke-[3]";
  const caret = switchable ? (
    <ChevronDown className="absolute bottom-0.5 right-0.5 size-2 stroke-[3] text-foreground" />
  ) : null;
  const changedTitle = changedFromBase ? " · changed from recommendation" : "";
  if (method === "barter")
    return (
      <span
        title={title ?? `Barter recommended${changedTitle}`}
        className={`${classes} ${routeIconClasses("barter", changedFromBase, filled, automaticFallback)}`}
      >
        <CircleArrowRight className={iconClasses} />
        {caret}
      </span>
    );
  if (method === "craft")
    return (
      <span
        title={title ?? `Craft recommended${changedTitle}`}
        className={`${classes} ${routeIconClasses("craft", changedFromBase, filled, automaticFallback)}`}
      >
        <Wrench className={iconClasses} />
        {caret}
      </span>
    );
  if (method === "trader")
    return (
      <span
        title={title ?? `Trader purchase recommended${changedTitle}`}
        className={`${classes} ${routeIconClasses("trader", changedFromBase, filled, automaticFallback)}`}
      >
        <UserRound className={iconClasses} />
        {caret}
      </span>
    );
  if (method === "flea")
    return (
      <span
        title={title ?? `Flea market recommended${changedTitle}`}
        className={`${classes} ${routeIconClasses("flea", changedFromBase, filled, automaticFallback)}`}
      >
        <ChartNoAxesCombined className={iconClasses} />
        {caret}
      </span>
    );
  if (method === "sell")
    return (
      <span
        title={title ?? `Sell value used${changedTitle}`}
        className={`${classes} ${routeIconClasses("sell", changedFromBase, filled, automaticFallback)}`}
      >
        <Coins className={iconClasses} />
        {caret}
      </span>
    );
  return (
    <span
      title={title ?? "No priced route"}
      className={`${classes} bg-danger-surface/60 text-danger `}
    >
      <LockKeyhole aria-label="Locked" className={iconClasses} />
      {caret}
    </span>
  );
}

export function routeChipClasses(method: RouteMethod) {
  if (method === "barter") return "bg-acquisition-barter text-inverse";
  if (method === "craft") return "bg-acquisition-craft text-inverse";
  if (method === "trader") return "bg-acquisition-trader text-inverse";
  if (method === "flea") return "bg-acquisition-flea text-inverse";
  if (method === "sell") return "bg-acquisition-sell-value text-inverse";
  return "bg-danger-surface/60 text-danger";
}

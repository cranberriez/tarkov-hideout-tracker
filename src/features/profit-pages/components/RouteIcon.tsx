import {
  ChartNoAxesCombined,
  ChevronDown,
  CircleArrowRight,
  UserRound,
  Wrench,
} from "lucide-react";
import type { RouteMethod } from "../types";

function routeIconClasses(
  method: Exclude<RouteMethod, "unavailable">,
  changedFromBase: boolean,
  filled: boolean,
) {
  const styles = {
    barter: {
      color: "text-sky-400",
      background: "bg-sky-400",
      border: "border-sky-400",
    },
    craft: {
      color: "text-orange-400",
      background: "bg-orange-400",
      border: "border-orange-400",
    },
    trader: {
      color: "text-purple-400",
      background: "bg-purple-400",
      border: "border-purple-400",
    },
    flea: {
      color: "text-emerald-400",
      background: "bg-emerald-400",
      border: "border-emerald-400",
    },
  }[method];

  if (filled) return `${styles.background} text-black`;

  return `bg-transparent ${styles.color} ${changedFromBase ? `border-[3px] border-dashed ${styles.border}` : ""}`;
}

export function RouteIcon({
  method,
  inline = false,
  rowRail = false,
  preview = false,
  filled = false,
  switchable = false,
  changedFromBase = false,
}: {
  method: RouteMethod;
  inline?: boolean;
  rowRail?: boolean;
  preview?: boolean;
  filled?: boolean;
  switchable?: boolean;
  changedFromBase?: boolean;
}) {
  const classes = `${rowRail ? "relative h-full w-8 shrink-0 self-stretch rounded-none" : preview ? "relative size-7 shrink-0 rounded shadow-md" : inline ? "relative size-[18px] shrink-0 rounded-[3px] shadow-md" : "absolute -left-1 -top-1 z-10 size-[18px] rounded-[3px] shadow-md"} flex items-center justify-center`;
  const iconClasses = preview ? "size-4 stroke-[3]" : "size-3.5 stroke-[3]";
  const caret = switchable ? (
    <ChevronDown className="absolute bottom-0.5 right-0.5 size-2 stroke-[3] text-white" />
  ) : null;
  const changedTitle = changedFromBase ? " · changed from recommendation" : "";
  if (method === "barter")
    return (
      <span
        title={`Barter recommended${changedTitle}`}
        className={`${classes} ${routeIconClasses("barter", changedFromBase, filled)}`}
      >
        <CircleArrowRight className={iconClasses} />
        {caret}
      </span>
    );
  if (method === "craft")
    return (
      <span
        title={`Craft recommended${changedTitle}`}
        className={`${classes} ${routeIconClasses("craft", changedFromBase, filled)}`}
      >
        <Wrench className={iconClasses} />
        {caret}
      </span>
    );
  if (method === "trader")
    return (
      <span
        title={`Trader purchase recommended${changedTitle}`}
        className={`${classes} ${routeIconClasses("trader", changedFromBase, filled)}`}
      >
        <UserRound className={iconClasses} />
        {caret}
      </span>
    );
  if (method === "flea")
    return (
      <span
        title={`Flea market recommended${changedTitle}`}
        className={`${classes} ${routeIconClasses("flea", changedFromBase, filled)}`}
      >
        <ChartNoAxesCombined className={iconClasses} />
        {caret}
      </span>
    );
  return (
    <span
      title="No priced route"
      className={`${classes} bg-gray-400 text-[11px] font-black`}
    >
      ?
      {caret}
    </span>
  );
}

export function routeChipClasses(method: RouteMethod) {
  if (method === "barter") return "bg-sky-400 text-black";
  if (method === "craft") return "bg-orange-400 text-black";
  if (method === "trader") return "bg-purple-400 text-black";
  if (method === "flea") return "bg-emerald-400 text-black";
  return "bg-gray-500 text-black";
}

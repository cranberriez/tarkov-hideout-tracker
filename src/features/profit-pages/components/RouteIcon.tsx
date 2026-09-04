import {
  ChartNoAxesCombined,
  ChevronDown,
  CircleArrowRight,
  UserRound,
  Wrench,
} from "lucide-react";
import type { RouteMethod } from "../types";

export function RouteIcon({
  method,
  inline = false,
  rowRail = false,
  switchable = false,
  changedFromBase = false,
}: {
  method: RouteMethod;
  inline?: boolean;
  rowRail?: boolean;
  switchable?: boolean;
  changedFromBase?: boolean;
}) {
  const classes = `${rowRail ? "relative h-full w-8 shrink-0 self-stretch rounded-none" : inline ? "relative size-[18px] shrink-0 rounded-[3px] shadow-md" : "absolute -left-1 -top-1 z-10 size-[18px] rounded-[3px] shadow-md"} flex items-center justify-center text-black`;
  const caret = switchable ? (
    <ChevronDown className="absolute bottom-0.5 right-0.5 size-2 stroke-[3] opacity-70" />
  ) : null;
  const changedTitle = changedFromBase ? " · changed from recommendation" : "";
  if (method === "barter")
    return (
      <span
        title={`Barter recommended${changedTitle}`}
        className={`${classes} ${changedFromBase ? "border-[3px] border-dashed border-sky-400 bg-sky-400/20 text-sky-300" : "bg-sky-400"}`}
      >
        <CircleArrowRight className="size-3.5 stroke-[3]" />
        {caret}
      </span>
    );
  if (method === "craft")
    return (
      <span
        title={`Craft recommended${changedTitle}`}
        className={`${classes} ${changedFromBase ? "border-[3px] border-dashed border-orange-400 bg-orange-400/20 text-orange-300" : "bg-orange-400"}`}
      >
        <Wrench className="size-3.5 stroke-[3]" />
        {caret}
      </span>
    );
  if (method === "trader")
    return (
      <span
        title={`Trader purchase recommended${changedTitle}`}
        className={`${classes} ${changedFromBase ? "border-[3px] border-dashed border-purple-400 bg-purple-400/20 text-purple-300" : "bg-purple-400"}`}
      >
        <UserRound className="size-3.5 stroke-[3]" />
        {caret}
      </span>
    );
  if (method === "flea")
    return (
      <span
        title={`Flea market recommended${changedTitle}`}
        className={`${classes} ${changedFromBase ? "border-[3px] border-dashed border-emerald-400 bg-emerald-400/20 text-emerald-300" : "bg-emerald-400"}`}
      >
        <ChartNoAxesCombined className="size-3.5 stroke-[3]" />
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

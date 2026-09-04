import { ChartNoAxesCombined, CircleArrowRight, UserRound, Wrench } from "lucide-react";
import type { RouteMethod } from "../types";

export function RouteIcon({
  method,
  inline = false,
}: {
  method: RouteMethod;
  inline?: boolean;
}) {
  const classes = `${inline ? "relative shrink-0" : "absolute -left-1 -top-1 z-10"} flex size-[18px] items-center justify-center rounded-[3px] text-black shadow-md`;
  if (method === "barter")
    return (
      <span title="Barter recommended" className={`${classes} bg-sky-400`}>
        <CircleArrowRight className="size-3.5 stroke-[3]" />
      </span>
    );
  if (method === "craft")
    return (
      <span title="Craft recommended" className={`${classes} bg-orange-400`}>
        <Wrench className="size-3.5 stroke-[3]" />
      </span>
    );
  if (method === "trader")
    return (
      <span title="Trader purchase recommended" className={`${classes} bg-purple-400`}>
        <UserRound className="size-3.5 stroke-[3]" />
      </span>
    );
  if (method === "flea")
    return (
      <span
        title="Flea market recommended"
        className={`${classes} bg-emerald-400`}
      >
        <ChartNoAxesCombined className="size-3.5 stroke-[3]" />
      </span>
    );
  return (
    <span
      title="No priced route"
      className={`${classes} bg-gray-400 text-[11px] font-black`}
    >
      ?
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

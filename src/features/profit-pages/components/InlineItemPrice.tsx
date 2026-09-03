"use client";

import { useState } from "react";
import {
  getItemBuyPrice,
  getItemSellPrice,
  type ManualPriceOverride,
} from "@/lib/price-calculation";
import type { GlobalItem } from "@/types";
import type { PriceChangeHandler } from "../types";
import { formatCompactPrice } from "../utils/formatters";

export function InlineItemPrice({
  item,
  kind,
  totalPrice,
  displayPrice,
  overrides,
  onPriceChange,
}: {
  item?: GlobalItem;
  kind: "buy" | "sell";
  totalPrice: number | null;
  displayPrice?: number | null;
  overrides: Record<string, ManualPriceOverride>;
  onPriceChange: PriceChangeHandler;
}) {
  const [editing, setEditing] = useState(false);
  if (!item) return <span>-</span>;
  const itemId = item.id;
  const currentUnitPrice =
    kind === "buy"
      ? getItemBuyPrice(item, overrides)
      : getItemSellPrice(item, overrides);
  const currentOverride = overrides[itemId] ?? {};
  function commit(raw: string) {
    const parsed = raw.trim() === "" ? undefined : Number(raw);
    onPriceChange(itemId, {
      ...currentOverride,
      [kind]:
        parsed !== undefined && Number.isFinite(parsed) && parsed >= 0
          ? parsed
          : undefined,
    });
    setEditing(false);
  }
  if (editing)
    return (
      <input
        autoFocus
        type="number"
        min="0"
        placeholder={
          currentUnitPrice === null
            ? "No price"
            : String(Math.round(currentUnitPrice))
        }
        defaultValue={currentOverride[kind]}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Enter") commit(event.currentTarget.value);
          if (event.key === "Escape") setEditing(false);
        }}
        onBlur={(event) => commit(event.currentTarget.value)}
        className="h-5 w-16 rounded border border-tarkov-green/50 bg-black px-1 text-[10px] text-foreground outline-none"
      />
    );
  return (
    <button
      type="button"
      title={`Edit ${kind} price`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setEditing(true);
      }}
      className="truncate text-tarkov-green hover:underline"
    >
      {formatCompactPrice(
        displayPrice === undefined ? totalPrice : displayPrice,
      )}
    </button>
  );
}

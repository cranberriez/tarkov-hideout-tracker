"use client";

import { QuestLink } from "@/components/entities/quest-link";
import { LockKeyhole } from "lucide-react";
import type { LockReason } from "@/lib/price-calculation";
import { useProfitPricingContext } from "./ProfitPricingContext";

export function LockReasons({ reasons, showIcon = true }: { reasons: readonly LockReason[]; showIcon?: boolean }) {
  const context = useProfitPricingContext();
  const uniqueReasons = [...new Map(reasons.map(reason => [JSON.stringify([reason.kind, reason.questId, reason.message]), reason])).values()];
  if (!reasons.length) return null;
  return <span data-isolated-hover="true" className="block space-y-1 p-1 text-left text-[10px] leading-snug text-danger">
    {uniqueReasons.map((reason, index) => <span key={`${reason.kind}:${reason.questId ?? ""}:${index}`} className="flex items-start gap-1">
      {showIcon && <LockKeyhole aria-label="Locked" className="mt-0.5 size-3 shrink-0" />}
      {reason.questId ? <span><span className="block">Complete Quest:</span><QuestLink className="block underline hover:text-foreground" questId={reason.questId} name={context.taskUnlocksById?.[reason.questId]?.name || "Quest details unavailable"} /></span> : <span>{reason.message}</span>}
    </span>)}
  </span>;
}

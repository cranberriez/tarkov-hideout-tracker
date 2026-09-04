import type { TarkovDataMode } from "@/types/common";
import type { PriceHistoryPoint } from "@/types/prices";

export interface PriceSyncState {
    etag: string | null;
    latestPointTimestamp: number | null;
}

export type PriceRefreshOutcome =
    | {
          status: "updated";
          itemId: string;
          etag: string | null;
          checkedAt: number;
          points: PriceHistoryPoint[];
          effectivePrice: number;
          sampleCount: number;
          totalOfferCount: number;
      }
    | {
          status: "not-modified";
          itemId: string;
          etag: string | null;
          checkedAt: number;
      }
    | {
          status: "failed";
          itemId: string;
          checkedAt: number;
          error: string;
      };

export interface PriceRefreshSummary {
    runId: string;
    mode: TarkovDataMode;
    status: "succeeded" | "partial" | "failed" | "skipped";
    eligibleCount: number;
    checkedCount: number;
    changedCount: number;
    notModifiedCount: number;
    failedCount: number;
    error?: string;
}

export interface PriceRefreshStore {
    getEligibleItemIds(mode: TarkovDataMode, releaseId: string): Promise<string[]>;
    getSyncStates(mode: TarkovDataMode): Promise<Record<string, PriceSyncState>>;
    tryAcquireLock(
        mode: TarkovDataMode,
        runId: string,
        lockedUntil: number,
        now: number,
    ): Promise<boolean>;
    releaseLock(mode: TarkovDataMode, runId: string): Promise<void>;
    startRun(runId: string, mode: TarkovDataMode, startedAt: number): Promise<void>;
    writeOutcomes(mode: TarkovDataMode, outcomes: PriceRefreshOutcome[]): Promise<void>;
    completeRun(summary: PriceRefreshSummary, completedAt: number): Promise<void>;
}

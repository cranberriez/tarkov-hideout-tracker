import { NextRequest, NextResponse } from "next/server";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { getItemUsage } from "@/server/services/itemAcquisitionJson";
import { getCachedFullQuestData, getCachedTraders } from "@/server/services/tarkovData";
import type { ItemUsagePayload } from "@/types";
import { isCompleteItemUsagePayload } from "@/lib/utils/item-usage";

const MODES = new Set<TarkovJsonGameMode>(["regular", "pve", "pvp-season"]);

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ itemId: string }> },
) {
    const { itemId } = await context.params;
    const requestedMode = request.nextUrl.searchParams.get("mode") ?? "regular";
    if (!MODES.has(requestedMode as TarkovJsonGameMode)) {
        return NextResponse.json({ error: "Unsupported game mode" }, { status: 400 });
    }
    if (!/^[a-zA-Z0-9_-]{8,80}$/.test(itemId)) {
        return NextResponse.json({ error: "Invalid item ID" }, { status: 400 });
    }

    const mode = requestedMode as TarkovJsonGameMode;
    const usage = await getItemUsage(itemId, mode);
    const traderIds = new Set(usage.barters.map((barter) => barter.traderId));
    const taskUnlockIds = new Set([
        ...usage.barters.flatMap((barter) =>
            barter.taskUnlockId ? [barter.taskUnlockId] : [],
        ),
        ...usage.crafts.flatMap((craft) =>
            craft.taskUnlockId ? [craft.taskUnlockId] : [],
        ),
    ]);
    const [tradersResult, questsResult] = await Promise.allSettled([
        traderIds.size > 0 ? getCachedTraders(mode) : null,
        taskUnlockIds.size > 0 ? getCachedFullQuestData(mode) : null,
    ]);
    const presentationFailed =
        (traderIds.size > 0 && tradersResult.status === "rejected") ||
        (taskUnlockIds.size > 0 && questsResult.status === "rejected");
    const response: ItemUsagePayload = {
        ...usage,
        tradersById:
            tradersResult.status === "fulfilled" && tradersResult.value
                ? Object.fromEntries(
                      tradersResult.value.data.traders
                          .filter((trader) => traderIds.has(trader.id))
                          .map((trader) => [trader.id, trader]),
                  )
                : {},
        taskUnlocksById:
            questsResult.status === "fulfilled" && questsResult.value
                ? Object.fromEntries(
                      questsResult.value.data.quests
                          .filter((quest) => taskUnlockIds.has(quest.id))
                          .map((quest) => [
                              quest.id,
                              { id: quest.id, name: quest.name, wikiLink: quest.wikiLink },
                          ]),
                  )
                : {},
        ...(presentationFailed
            ? { presentationError: "Acquisition labels are temporarily unavailable" }
            : {}),
    };
    return NextResponse.json(response, {
        headers: {
            "Cache-Control": !isCompleteItemUsagePayload(response)
                ? "no-store"
                : "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
        },
    });
}

import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { createJiti } from "jiti";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient } from "../../../lib/query/client";

const jiti = createJiti(import.meta.url, { alias: { "@": path.join(process.cwd(), "src") }, jsx: { runtime: "automatic" }, fsCache: false });
const { ItemDetailUsageTabs } = await jiti.import<typeof import("./ItemDetailUsageTabs")>("./ItemDetailUsageTabs.tsx");

test("usage tab content scrolls independently below a fixed tab bar", () => {
    const client = createQueryClient();
    const markup = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(ItemDetailUsageTabs, {
        selectedItemId: "item-a",
        stationRequirements: [],
        stationLevels: {},
        hiddenStations: {},
        questItemState: null,
        questRewards: [],
        anyOfGroups: [],
        itemDetailsById: {},
        traderOffers: [],
        crafts: [],
        relationsLoading: true,
        relationsError: null,
        onRetryRelations: () => {},
        acquisitionLoading: true,
        barterError: null,
        craftError: null,
        onRetryAcquisition: () => {},
        acquisitionWarning: null,
        completedQuests: {},
        traderLoyaltyLevels: {},
        gameEdition: null,
        gameMode: "regular",
        showPriceHistory: false,
        barterEvaluationsById: {},
        craftEvaluationsById: {},
        profitLoading: false,
        profitError: null,
        onRetryProfit: () => {},
        onItemClick: () => {},
    })));

    assert.match(markup, /class="[^"]*shrink-0[^"]*" role="tablist"/);
    assert.match(markup, /role="tabpanel"[^>]*class="[^"]*max-h-\[700px\][^"]*overflow-y-auto/);
});

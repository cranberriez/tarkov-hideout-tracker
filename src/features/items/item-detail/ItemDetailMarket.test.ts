import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { createJiti } from "jiti";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const jiti = createJiti(import.meta.url, { alias: { "@": path.join(process.cwd(), "src") }, jsx: { runtime: "automatic" }, fsCache: false });
const { ItemDetailMarket } = await jiti.import<typeof import("./ItemDetailMarket")>("./ItemDetailMarket.tsx");

test("stable and unstable market UI shows distinct price semantics and raw context", () => {
    const props = { relativeUpdatedAt: "2 hours ago", valuationCount: 1, isFiat: false, playerLevel: 1, minLevelForFlea: 15 };
    const marketPrice = { price: 120_000, referencePrice: 973_333, avg24hPrice: 925_926, lastLowPrice: 120_000, lastOfferCount: 2 };
    const unstable = renderToStaticMarkup(createElement(ItemDetailMarket, { ...props, marketPrice: { ...marketPrice, fleaStability: "unstable" } }));
    assert.match(unstable, /Value unstable/);
    assert.match(unstable, /text-amber-300/);
    assert.doesNotMatch(unstable, /excluded from automatic|Signals:/);
    assert.doesNotMatch(unstable, /role="tooltip"/);
    assert.match(unstable, /Flea estimate/);
    assert.match(unstable, /Latest aggregate/);
    assert.match(unstable, /Latest minimum/);
    assert.match(unstable, /2 offers/);
    assert.match(unstable, /2 hours ago/);
    assert.match(unstable, /Catalog 24h average/);
    const stable = renderToStaticMarkup(createElement(ItemDetailMarket, { ...props, marketPrice: { ...marketPrice, fleaStability: "stable" } }));
    assert.doesNotMatch(stable, /Value unstable/);
    assert.match(stable, /Flea estimate/);
    const reference = renderToStaticMarkup(createElement(ItemDetailMarket, { ...props, marketPrice: { avg24hPrice: 120_000, fleaStability: "reference" } }));
    assert.match(reference, /120,000/);
    assert.doesNotMatch(reference, /Release reference|Offer depth unknown/);
    const unavailable = renderToStaticMarkup(createElement(ItemDetailMarket, { ...props, marketPrice: { ...marketPrice, price: null, lastOfferCount: 0, fleaStability: "unavailable" } }));
    assert.match(unavailable, /Flea unavailable/);
    assert.match(unavailable, /0 offers/);
    const empty = renderToStaticMarkup(createElement(ItemDetailMarket, { ...props, marketPrice: {} }));
    assert.equal(empty, "");
});

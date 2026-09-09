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
    const marketPrice = {
        price: 120_000,
        referencePrice: 973_333,
        avg24hPrice: 925_926,
        lastLowPrice: 120_000,
        low24hPrice: 100_000,
        high24hPrice: 150_000,
        lastOfferCount: 2,
    };
    const unstable = renderToStaticMarkup(createElement(ItemDetailMarket, { ...props, marketPrice: { ...marketPrice, fleaStability: "unstable" } }));
    assert.match(unstable, /value unstable/);
    assert.match(unstable, /text-warning/);
    assert.doesNotMatch(unstable, /excluded from automatic|Signals:/);
    assert.doesNotMatch(unstable, /role="tooltip"|aria-label="Value unstable"/);
    assert.match(unstable, /Flea estimate/);
    assert.match(unstable, /rounded-md border border-border-color bg-shadow\/25 px-2\.5 py-2/);
    assert.doesNotMatch(unstable, /Latest aggregate/);
    assert.doesNotMatch(unstable, /Latest minimum/);
    assert.match(unstable, /2 offers/);
    assert.match(unstable, /2 hours ago/);
    assert.doesNotMatch(unstable, /Catalog 24h average/);
    assert.match(unstable, /24h low/);
    assert.match(unstable, /100,000/);
    assert.match(unstable, /24h high/);
    assert.match(unstable, /150,000/);
    assert.match(unstable, /mt-4 grid grid-cols-2/);
    assert.match(unstable, /px-3 py-2\.5/);
    assert.doesNotMatch(unstable, /gap-px overflow-hidden rounded-lg border/);
    const stable = renderToStaticMarkup(createElement(ItemDetailMarket, { ...props, marketPrice: { ...marketPrice, fleaStability: "stable" } }));
    assert.doesNotMatch(stable, /value unstable/);
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


test("unstable market shows compact evidence without inventing missing observations", () => {
    const props = { relativeUpdatedAt: null, valuationCount: 1, isFiat: false, playerLevel: 15, minLevelForFlea: 15 };
    const marketPrice = { price: 100_000, lastLowPrice: 100_000, referencePrice: 400_000, fleaStability: "unstable" as const, fleaPriceReasons: ["sparse-offers", "divergent-reference"] as const, fleaSampleCount: 2 };
    const render = (price: import("@/types/prices").CurrentPrice) => renderToStaticMarkup(createElement(ItemDetailMarket, { ...props, marketPrice: price }));
    const markup = render({ ...marketPrice, fleaPriceReasons: [...marketPrice.fleaPriceReasons] });
    assert.match(markup, /Thin offers/);
    assert.match(markup, /Recent prices disagree/);
    assert.match(markup, /width:25%/);
    assert.match(markup, /width:100%/);
    assert.match(markup, /2 recent observations/);
    assert.doesNotMatch(markup, /role="tooltip"/);
    const missing = render({ price: 100, fleaStability: "unstable", fleaPriceReasons: ["unknown-depth"], lastLowPrice: NaN, referencePrice: -1 });
    assert.match(missing, /Offer count unknown/);
    assert.doesNotMatch(missing, /Price comparison|NaN|observations/);
    const stable = render({ ...marketPrice, fleaPriceReasons: [], fleaStability: "stable" });
    assert.doesNotMatch(stable, /Price stability details|Reported price/);
});

import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { createJiti } from "jiti";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ItemSummary } from "@/types/items";

const jiti = createJiti(import.meta.url, { alias: { "@": path.join(process.cwd(), "src") }, jsx: { runtime: "automatic" }, fsCache: false });
const { InlineItemPrice } = await jiti.import<typeof import("./InlineItemPrice")>("./InlineItemPrice.tsx");

test("unstable output sale uses yellow price and an isolated warning icon, with no row message", () => {
    const item: ItemSummary = { id: "sass", name: "SASS", normalizedName: "sass", marketPrice: { price: 120_000, fleaStability: "unstable" } };
    const props = { item, kind: "sell" as const, totalPrice: 120_000, overrides: {}, onPriceChange: () => {} };
    const markup = renderToStaticMarkup(createElement(InlineItemPrice, props));
    assert.match(markup, /120k/);
    assert.match(markup, /text-warning/);
    assert.match(markup, /aria-label="Value unstable"/);
    assert.match(markup, /data-isolated-hover="true"/);
    assert.doesNotMatch(markup, /role="tooltip"|excluded|>Value unstable</);
    for (const variation of [
        { ...props, sellValueIsEstimate: false },
        { ...props, kind: "buy" as const },
        { ...props, overrides: { sass: { sell: 130_000 } } },
        { ...props, item: { ...item, marketPrice: { ...item.marketPrice, fleaStability: "stable" as const } } },
        { ...props, item: { ...item, marketPrice: { ...item.marketPrice, sellFor: [{ vendor: { name: "Trader", normalizedName: "trader" }, priceRUB: 150_000 }] } } },
    ]) {
        assert.doesNotMatch(renderToStaticMarkup(createElement(InlineItemPrice, variation)), /Value unstable/);
    }
});


test("ingredient warning follows unstable flea purchases and respects manual overrides", () => {
    const item: ItemSummary = { id: "input", name: "Input", normalizedName: "input", marketPrice: { price: 120_000, fleaStability: "unstable" } };
    const props = { item, kind: "buy" as const, buyMethod: "flea" as const, totalPrice: 120_000, overrides: {}, onPriceChange: () => {} };
    const markup = renderToStaticMarkup(createElement(InlineItemPrice, props));
    assert.match(markup, /\(value unstable\)/);
    assert.doesNotMatch(markup, /aria-label="Value unstable"|role="tooltip"/);
    for (const variation of [
        { ...props, buyMethod: "trader" as const },
        { ...props, buyMethod: "craft" as const },
        { ...props, buyMethod: "barter" as const },
        { ...props, buyMethod: "unavailable" as const },
        { ...props, totalPrice: null },
        { ...props, overrides: { input: { buy: 0 } } },
        { ...props, overrides: { input: { buy: 130_000 } } },
        { ...props, item: { ...item, marketPrice: { price: 120_000, fleaStability: "stable" as const } } },
    ]) {
        assert.doesNotMatch(renderToStaticMarkup(createElement(InlineItemPrice, variation)), /value unstable/);
    }
});

test("ingredient opportunity costs are labeled as sell value", () => {
    const item: ItemSummary = {
        id: "input",
        name: "Input",
        normalizedName: "input",
        onFleaMarket: false,
        marketPrice: { sellFor: [{ vendor: { name: "Trader", normalizedName: "trader" }, priceRUB: 42 }] },
    };
    const markup = renderToStaticMarkup(createElement(InlineItemPrice, {
        item,
        kind: "buy" as const,
        buyMethod: "sell" as const,
        totalPrice: 84,
        overrides: {},
        onPriceChange: () => {},
    }));

    assert.match(markup, /84 ₽/);
    assert.match(markup, /\(sell value\)/);
    assert.doesNotMatch(markup, /value unstable/);
});

test("manual buy and sell prices use the customized blue treatment", () => {
    for (const kind of ["buy", "sell"] as const) {
        const item: ItemSummary = { id: kind, name: kind, normalizedName: kind, marketPrice: { price: 120_000 } };
        const markup = renderToStaticMarkup(createElement(InlineItemPrice, {
            item,
            kind,
            totalPrice: 130_000,
            overrides: { [kind]: { [kind]: 130_000 } },
            onPriceChange: () => {},
        }));

        assert.match(markup, /text-info/);
    }
});

import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { createJiti } from "jiti";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const jiti = createJiti(import.meta.url, {
  alias: { "@": path.join(process.cwd(), "src") },
  jsx: { runtime: "automatic" },
  fsCache: false,
});
const { ProfitCell } = await jiti.import<
  typeof import("./ProfitCells")
>("./ProfitCells.tsx");

test("customized profit stacks its crossed-out baseline above its signed-color value", () => {
  const markup = renderToStaticMarkup(
    createElement(
      ProfitCell,
      {
        label: "Profit",
        value: 150,
        customized: true,
        originalValue: "100 ₽",
      },
      "150 ₽",
    ),
  );

  assert.match(markup, /line-through/);
  assert.match(markup, /100 ₽/);
  assert.match(markup, /flex-col/);
  assert.match(markup, /text-success/);
  assert.doesNotMatch(markup, /text-info/);
  assert.match(markup, /150 ₽/);
  assert.match(markup, /Profit uses customized pricing/);
});

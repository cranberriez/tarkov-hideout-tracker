# Barter and crafting profits

Both profit routes enter [ProfitPage](../src/features/profit-pages/ProfitPage.tsx),
which loads [getProfitPageData](../src/server/queries/getProfitPageData.ts) and
renders [ProfitPageClient](../src/features/profit-pages/ProfitPageClient.tsx).
The query supplies both normalized recipe graphs, referenced item prices, and
compact trader/station presentation. Both graphs are required because acquisition
can cross between crafts and barters; either graph error blocks profit figures.
Stored acquisition views remain unpriced graphs; [data layer](data-layer.md) owns
runtime hydration and the price refresh pipeline.

## Calculation owners and rules

[recipes.ts](../src/features/profit-pages/utils/recipes.ts) builds a calculation
pass over the graphs using the shared [price-calculation engine](../src/lib/price-calculation/).
[optimizer.ts](../src/lib/price-calculation/optimizer.ts) chooses recursive
acquisition routes; [prices.ts](../src/lib/price-calculation/prices.ts) resolves
buy/sell inputs. Rows and item-modal recipe views consume completed evaluations
rather than selecting routes independently.

- Flea purchase and flea sale estimates share the robust minimum and stability
  model in [data layer](data-layer.md). Unstable mutable flea values remain usable
  rough estimates; instability alone never selects a lower trader value. Unavailable
  flea values remain null without reviving a catalog aggregate. Release
  reference pricing remains usable when mutable storage/points are absent or
  unusable. These estimates do not prove that any quantity can sell at that price.
- Sale proceeds compare flea after listing fees and best untaxed trader sale, explicitly naming the
  selected source. Trader purchases remain separately gated routes, never caps
  on flea values. Mode-scoped manual buy/sell overrides replace the corresponding
  input, including unstable or unavailable flea inputs; zero manual prices remain
  valid. Roubles have unit value one. Browser persistence is unchanged.
- Direct trader purchases are leaf routes from `ItemSummary.buyFromTrader`,
  separate from barter records. Loyalty and task unlocks gate eligibility.
- Flea access uses the active player's level and the item's `onFleaMarket` and
  `minLevelForFlea` metadata, with a minimum player level of 15. Locked flea
  purchases cannot supply ingredients. Manual prices remain explicit overrides.
- Crafts and barters may recursively supply ingredients. Batch quantities round
  up; cycle/depth guards bound traversal. Tools are reusable and excluded from
  recurring cost and opportunity-value calculations. A nested craft still requires
  an accessible acquisition route for its tools before it can be recommended.
- Preserve both the theoretical cheapest result and the practical recommendation.
  The cheaper eligible direct purchase wins among direct candidates. A recursive
  route must save enough under the engine's threshold (the smaller of 5% of the
  cheapest direct cost or 5,000 roubles) to justify its added steps.
- Zero-input production and quest-only ingredients have unknown cost; they cannot
  act as free recursive sources. Missing pricing remains explicit.
- Passive Bitcoin Farm production and the Water Collector's same-item bottled-water
  refill are excluded from the normalized craft graph and therefore do not appear
  as craft rows or recursive acquisition routes.
- When an ingredient has no accessible priced acquisition route but does have a
  usable sale value, its acquisition cost falls back to that opportunity value:
  the money forgone by consuming a primarily found-in-raid item instead of selling
  it. Profit pages and item-detail recipes label this route **(sell value)**. If
  neither an acquisition route nor a sale source is usable, costs, sale values and
  dependent profit figures remain null. Unstable estimates continue to
  price both recipe inputs and outputs. `sellValueIsEstimate` marks a selected
  unstable flea sale; `sellSourceLabel` names the selected source. Manual sales
  and selected trader sales do not carry the instability warning.
- Output sale text turns yellow with a small warning icon; hover or keyboard
  focus shows **Value unstable** in a compact overlay. There is no row-wide warning.
  Ingredient flea purchases show small **(value unstable)** text beside their
  prices on profit pages and in modal crafting/barter ingredients; manual buy
  overrides and non-flea routes do not carry this warning. The item modal market
  estimate uses small **value unstable** text without an icon or popup. Sale value, profit and
  profit/hour all use the same estimate, including after ingredient-route changes.
  Route profit and owned-input opportunity value remain distinct. Header totals
  count unpriced rows explicitly; positive value sums priced rows only.
- Hourly profit includes sequential nested craft time allocated per produced item;
  root crafts include their own duration. Instantaneous barter paths have no hourly
  value. The Skills panel has Crafting and Hideout Management level text inputs (0-50), validates
  after 500 ms or on blur, and clamps numeric values to that range. Invalid or
  empty text restores the saved level. Each Elite toggle stores 51 and disables
  its input at an effective level of 50. Turning Elite off leaves level 50.
  [Seasonal configuration](../src/lib/cfg/seasonal.ts) forces Elite for Season 1
  KORD Breach. The shared profit-options hook applies the rule to both profit
  pages and item details, and disables the Elite toggle with a short season note.
  Change `forceEliteCrafting` in that file to lift the override. Saved skill
  preferences remain untouched and apply again when the override is removed.
  The panel shows the time reduction inline and a short concurrent-crafts note
  only for Elite. Missing saved levels default
  to zero. Each level cuts craft time by 0.75%, capped at 37.5% for both 50 and
  Elite. The shared engine applies this to root and nested crafts. Adjusted durations also appear in
  previews, manual route changes, and item details. Elite allows two different
  crafts per zone (including Scav Case); the panel explains this benefit, while
  profit/hour remains per recipe. The table does not model station scheduling;
  the persistent Craft Planner is described below. Flea fees are applied to sales.
  Hideout Management reduces Superwater's base Water filter
  consumption by 0.5% per level, capped at 25% for level 50 and Elite. The adjusted
  quantity and cost are shared by profit pages, recursive routes, and item details.
  Fuel costs and the skill's fuel effect are not modeled.
- Route profit assumes acquisition of inputs. Owned-input opportunity value compares
  selling the ingredients individually with selling the recipe output; preserve
  that distinction in labels and calculations.

## Availability and UI

Barters and direct trader offers require active-profile loyalty and quest unlocks;
crafts require station level and quest unlocks. `buyLimit` and `restockAmount` are
presentation metadata, not optimizer quantity/live-stock constraints.

[availability.ts](../src/lib/price-calculation/availability.ts) supplies separate
flea, quest, trader loyalty, and station lock reasons. Recipe quest checks use
`taskUnlockId` on the recipe or trader offer and the profile's completed quest
IDs; they do not scan quest rewards. The page resolves only those known quest IDs
for compact name/link presentation. Missing names remain explicit and never
remove unlock requirements. Quest reasons show **Complete Quest:** above the
linked quest name. These checks also apply recursively to ingredient routes. The optimizer
selects the next usable source and retains locked alternatives for manual
inspection with explanatory reason rows. Players may explicitly select a locked
source to view its known hypothetical cost and recipe chain, but locked sources
never become automatic recommendations or eligible recursive inputs. If every
route fails, ingredient costs and dependent profits remain unknown and the
ingredient displays a red lock reason.

Outputs that cannot be sold on the flea have a red background and lock indicator,
even when they can be sold to a trader. The vendor fallback option uses the best
trader sale by default; disabling it leaves locked output sales unpriced unless
there is a manual sale override. Owned-input opportunity values always use usable
sales, independently of the output fallback option. The master **Hide locked
recipes** filter covers recipe locks, flea output locks, and unavailable ingredient
routes. Separate filters hide flea-sale, quest, vendor, or station locks. These
options persist per app mode and are shared by both profit pages, independently
of saved progress and price overrides. The menu groups list filters, availability,
output valuation, and ingredient sources.
An explicitly linked recipe remains visible with its lock reasons so its profit
breakdown can still be inspected.

Source-level explanations show the current station/trader level alongside the
existing required-level display. Source and ingredient explanations omit redundant
lock icons; output explanations retain theirs. Locked dropdown choices retain the
normal item/source/price layout, with a red background and a reason header that
owns the lock icon. Display-only locked prices use known flea/trader offers or
eligible ingredients for a hypothetical recipe; they never make a route eligible.
Unknown route costs remain dashes. Locked estimates do not recursively expand
other locked recipe estimates.

Ingredient route controls use a solid method-colored border for a manual selection
that differs from the recommendation. A dashed border identifies an automatic
fallback only when a priced locked alternative would beat the selected route,
respecting the practical savings threshold for recipes versus direct purchases.
The initial best route is borderless; merely having alternatives (locked or usable)
does not add a border. Unknown locked prices cannot establish a fallback. Tooltips
report available/locked source counts and explain marked fallbacks.
Ingredient controls have no muted background or divider lines between ingredients.
Output tint fills the cell height while the item details stay at the top; locked
outputs retain their red tint.
Automatic recommendations still exclude locked sources; the existing ingredient
source toggles control whether crafts and barters participate.

[ProfitPageClient](../src/features/profit-pages/ProfitPageClient.tsx) owns filters,
evaluation, selection, and modal navigation. [Components](../src/features/profit-pages/components/)
render sorting, source/availability filters, recipe chains, route alternatives,
price inputs, and recipe previews. The default metric is descending profit/hour.
Table ordering uses the current market-price evaluation as its baseline, so manual
buy or sell overrides recalculate a row without moving it. Editable customized
item prices use blue text. Profit and profit/hour retain their normal signed
green/red color and stack below the crossed-out baseline value for comparison.
[useManualPriceOverrides](../src/features/profit-pages/useManualPriceOverrides.ts)
and [usePinnedCrafts](../src/features/profit-pages/usePinnedCrafts.ts) persist
independently by app mode; key and reset semantics belong to [user state](user-state.md).

[ItemDetailRecipeProfit](../src/features/items/item-detail/ItemDetailRecipeProfit.tsx)
uses the same engine with a bounded acquisition tree. Recipe links navigate to
the corresponding profit row; standard ingredient clicks reuse item-modal navigation.
When extending calculations, update the engine and consumers together so a modal
and a full profit page do not disagree for the same inputs.

## Flea tax and net proceeds

[calc-tax.ts](../src/lib/price-calculation/calc-tax.ts) owns the pure RUB listing
fee calculation. It uses the supplied offer/requirement logarithmic modifiers,
0.05 tax constants, and quantity scaling; rounding occurs once after the hideout
reduction. Intelligence Center 3 reduces the fee by 30%, plus 0.3 percentage
points per Hideout Management level, capped at 45% at level 50/Elite. Below
Intelligence Center 3 there is no reduction. Bulk has no per-item discount.

Base value is inferred from full-item catalog trader buybacks in roubles and
the corresponding trader multiplier. Fixed trader estimates use their median
to tolerate rounding. Fence/Ref are fallbacks; Ref requires a known loyalty tier.
An absent base value never becomes a zero flea fee: use a known trader return
or leave flea proceeds unknown. Raw market prices and price history stay gross.

The sale comparison evaluates the whole output quantity and chooses by net
proceeds. `selectedPrice` remains the gross unit asking price for editors;
`selectedNetPrice` is net per unit. `grossTotal`, `fee`, and `netTotal` describe
the listing. Recipe `sellValue` now means net proceeds; `grossSellValue` and
`sellFee` retain the breakdown. Profit, profit/hour, route changes, sorting,
and comparisons against selling the ingredients all use net proceeds. There is
no tax on purchased inputs, trader sales, or intermediate outputs consumed in a
craft. Manual sale overrides can name flea/trader; older overrides infer flea
when accessible, otherwise trader. Existing saved numbers are not rewritten.

Flea break-even and 10% return targets solve for an asking price after the
nonlinear fee, including its high-price peak; unreachable targets stay unknown.
Main profit views show proceeds/profit, with fees in tooltips or expanded details.
Fuel, initial reusable-tool purchases, finite stock and sale execution are not
modeled.

## Craft planner

[CraftPlannerClient](../src/features/profit-pages/optimize/CraftPlannerClient.tsx)
continues to load the shared bounded profit query, profile unlocks, skill settings,
manual prices, and both recipe graphs. It mounts
[StationBoard](../src/features/profit-pages/optimize/StationBoard.tsx), replacing
the previous continuous scheduling panel and its temporary selections.

The board uses horizontal station rows with output, duration, required inputs,
gross sale price per output, net batch profit, profit/hour, pin and detail actions.
Smaller screens wrap the rows. A station expands to a four-craft shortlist;
players can reveal all alternatives and include unprofitable crafts. Ranking
offers profit/hour, batch profit, long runs, and easy inputs (distinct purchase
sources plus intermediate craft/barter steps). Profit/hour assumes prompt
restarts and includes allocated intermediate craft time, not an automated queue.
New users see the first station with recommendations expanded. Returning users
see saved crafts. Done picking collapses the station to all its pinned crafts.
Pins are unlimited reminders, not concurrent jobs; no station-slot scheduler,
continuous-run controls, inventory deduction or automatic starts are implied.

[station-board.ts](../src/features/profit-pages/optimize/station-board.ts) derives
buy-input, barter-enabled and craft-input evaluations from the shared calculator.
The default is direct acquisition. Available recommendations require priced,
unlocked input routes and positive profit unless losses are explicitly included.
Trader-only output sales remain eligible. Saved crafts remain visible even when
locked, unpriced or losing money. Missing saved routes invalidate the estimate
until the user chooses a new route; they never silently select another source.

[StationCraftDetails](../src/features/profit-pages/optimize/StationCraftDetails.tsx)
compares distinct acquisition approaches together, then displays selectable
ingredient sources and editable costs. Recipe-specific input unit costs update
profit immediately and persist without changing other crafts. Sale overrides
reuse the existing item-wide mode-scoped prices, with an explicit flea/trader
destination and a best-net-return reset. Fee details, estimated flea break-even,
10% return target and optional acquisition steps live here. Materials required
pool purchased leaves for one batch of each available saved craft; reusable tools
are separate and pooled by maximum quantity, without assuming inventory access.

The board and profit table share existing craft pins. The additional
`tarkov-craft-board-v1:{mode}` payload stores recipe variant, ingredient route keys,
and custom unit costs. Stable recipe/item IDs and PVP/PVE/KORD isolation are
preserved. Changes to rankings or fresh prices do not clear selections. Unknown
recipe IDs stay saved and can be explicitly unpinned. Existing pins/price keys
now synchronize across mounted consumers and tabs without mount-time writes.
There are no new server reads or changes to reset actions. Trend collection,
selling-hour predictions and transaction logs remain outside this version.

## Validation

```bash
node --test --import jiti/register src/lib/price-calculation/optimizer.test.ts src/features/profit-pages/utils/recipes.test.ts src/server/queries/page-data-queries.test.ts
node --test --import jiti/register src/features/profit-pages/optimize/station-board.test.ts src/lib/price-calculation/calc-tax.test.ts
```

Include tests for the changed route/availability/pricing rule and browser checks
for affected table sorting, overrides, pins, recipe links, and mode switching.

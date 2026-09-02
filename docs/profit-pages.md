# Barter and Crafting Profit Pages

`/items/barter-profits` and `/items/crafting-profits` share a client-side price
calculation engine. Visiting either route loads the complete normalized barter and
craft indexes from their existing 24-hour Redis caches. Other item pages continue
to use the small per-item usage route and do not receive these indexes.

## Pricing

- Item acquisition from the flea market uses `avg24hPrice`.
- Sale value uses the higher of `avg24hPrice` and the item's best trader-sale value.
  Trader offers retain their original amount/currency alongside the converted
  rouble value used for comparison.
- A mode-scoped manual buy or sell price overrides the corresponding source value.
- Roubles have a fixed unit value of one. Other currencies use catalog pricing or
  a manual override.
- Flea fees and historical-price prediction are not included in the first version.
- Reusable tools are shown as requirements but excluded from recurring recipe cost
  and profit-per-hour calculations because they are returned after the craft.

## Recursive routes

Each ingredient can be bought, crafted, or bartered. Recipes are evaluated in
batches, so a requirement of three items from a two-item craft runs two batches.
The engine combines different acquisition methods within one recipe and protects
against circular recipe graphs and excessive depth.

The theoretically cheapest route is retained. For the recommended route, a flea
purchase wins when a recursive alternative saves no more than the smaller of 5%
of direct purchase cost or 5,000 roubles. This avoids recommending long chains for
negligible savings while still showing the theoretical result.

Zero-input production and recipes that require quest-only items are reported with
an unknown cost. They are not treated as free recursive ingredient sources because
their operational or non-market costs are absent from the price catalog.

Profit per hour uses the sequential duration of any crafted ingredients in the
recommended route. Craft rows also include the root craft duration; barter rows
show no hourly value when their ingredient route is instantaneous. Nested craft
time is allocated per produced item, so using one item from a craft that produces
four adds one quarter of that craft's duration. Station-aware parallel scheduling
is a future enhancement.

Each root recipe also calculates the opportunity value of selling its required
items individually using their best sale values. This does not replace route
profit because the figures answer different questions: route profit assumes the
ingredients are acquired for the recipe, while opportunity value applies when the
player already owns them. The table labels the former explicitly as `Route profit`.
When crafting or bartering an ingredient costs less than buying it directly, the
ingredient line shows the route's total savings. Its isolated info tooltip compares
the route cost with the direct flea purchase and suppresses the larger item tooltip.
When all non-tool inputs could be sold individually for more than the recipe output,
an info icon beside route profit instead recommends selling the ingredients and
shows the full owned-input comparison. Reusable tools are excluded because the
recipe returns them.

## Availability and filtering

Barter availability currently checks the active profile's trader loyalty and
required quest completion. Craft availability checks station level and required
quest completion. The page models retain station IDs, trader IDs, levels, quest
unlock IDs, edition restrictions, and buy limits for future filters and detail
views.

Both pages support output search, source filtering, availability filtering,
profit filtering, and relevant profit/cost sorts. Craft source filters are based
on hideout station; barter source filters are based on trader.

Availability and profit-only filters live in the page options menu. Availability
filtering is enabled by default. The same menu
can disable craft or barter routes for recipe ingredients independently. These
route switches do not remove the root recipes from their respective pages; they
only constrain how the calculator may obtain each required item.

## Recipe presentation and price editing

Produced items appear first in their own column, followed by a flexible-width
required-items column. Each requirement occupies one compact line containing its
acquisition badge, image, full name, quantity, and unit route price; recipes with
many ingredients grow vertically instead of scrolling sideways. The solid badge
uses a green market chart for flea, blue circled arrow for barter, or orange
wrench for crafting. Output items omit this badge because their production source
is already represented by the row. Locked root recipes show a lock badge fully
outside the right edge of the trader or station image. Source levels appear inline
with the source name.

Rows with crafted or bartered ingredient routes expose an action at the far left.
The expanded area starts one level below the viewed recipe: every top-level
crafted or bartered ingredient forms a separate branch, while top-level flea-only
ingredients are omitted. Each branch then shows that ingredient's recipe inputs
and any deeper routes. A simple border separates independent branches. Recipe
steps link to their source recipe, including navigation between the barter and
crafting profit pages.

Dark hover cards provide the item image, selected acquisition route, source
trader or station, loyalty/level, batch count, route duration, catalog or manual
unit price, quantity, route total, flea-price comparison, savings, and any cheaper
theoretical alternative. Crafted and bartered items add a recipe card to the
right with the source trader or station and required items. Reusable tools are
clearly marked as excluded from recurring cost. Hover cards remain close to the
pointer when they must move above a low row. Clicking an item's portrait opens
the shared item-detail modal; hovering a crafted or bartered requirement also
reveals a button that opens its recipe.

Output sale presentation compares the flea value with the highest trader offer.
Close prices (within 5%, capped at 5,000 roubles) are both shown in the row; hover
details always show both available values. Trader offers use their original
currency while comparison and profit math use `priceRUB`.

Recipe rows use TanStack's window virtualizer. The required-item count provides
the initial row-height estimate, and rendered rows are measured so recipes with
many ingredients retain their full dynamic height. The table keeps document-level
vertical scrolling and its existing horizontal overflow behavior.

Clicking an ingredient price edits that item's manual buy value; clicking an
output price edits its manual sell value. The input placeholder shows the current
catalog or override unit price. Clearing the input removes only that side of the
item's override. Every recipe row shows total craft time beneath its profit value,
including nested ingredient crafts, and each required-item line shows its own route
craft time when nonzero.

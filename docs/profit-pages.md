# Barter and Crafting Profit Pages

`/items/barter-profits` and `/items/crafting-profits` share a client-side price
calculation engine. Visiting either route loads the complete normalized barter and
craft indexes from their existing 24-hour Redis caches. Other item pages continue
to use the small per-item usage route and do not receive these indexes.

## Pricing

- Item acquisition from the flea market uses `avg24hPrice`.
- Sale value uses the higher of `avg24hPrice` and the item's best trader-sale value.
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

Rows do not expand. Dark hover cards provide the item image, selected acquisition
route, source trader or station, loyalty/level, batch count, route duration,
catalog or manual unit price, quantity, route total, and any cheaper theoretical
alternative. Reusable tools are clearly marked as excluded from recurring cost.
Hover cards remain close to the pointer when they must move above a low row.
Clicking an item's portrait opens the shared item-detail modal.

Clicking an ingredient price edits that item's manual buy value; clicking an
output price edits its manual sell value. The input placeholder shows the current
catalog or override unit price. Clearing the input removes only that side of the
item's override. Craft rows include a dedicated full-route-time column.

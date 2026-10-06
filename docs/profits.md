# Barter and crafting profits

Both profit routes enter [ProfitPage](../src/features/profit-pages/ProfitPage.tsx),
which loads [getProfitPageData](../src/server/queries/getProfitPageData.ts) and
renders [ProfitPageClient](../src/features/profit-pages/ProfitPageClient.tsx).
Craft Planner consumes the same mode-keyed `recipes-crafts-barters` Query cache. Station pages stream the same payload and evaluate their station's crafts with the shared calculator, skills and overrides.
Server pages prefetch and hydrate that payload, and client refetches update every
consumer without duplicating the graph arrays. The metadata query supplies both normalized recipe graphs, referenced items, and
compact trader/station presentation without prices. The shared mode/item price
cache loads the named recipes scope in one GET, reusing prices from other pages.
Initial figures wait for prices; one-hour freshness and manual refresh are owned
by [the shared price layer](data-layer.md). Metadata refetches do not refresh prices. Both graphs are required because acquisition
can cross between crafts and barters; either graph error blocks profit figures.
Stored acquisition views remain unpriced graphs; [data layer](data-layer.md) owns
shared runtime pricing and the price refresh pipeline.

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
- A saved empty-container sale price, less estimated flea tax, replaces acquisition cost for consumed Metal and
  Expeditionary fuel-can ingredients, including nested crafts/barters, locked
  previews and owned-input opportunity values. The explicit **Empty value** route
  uses the net proceeds from a manually entered pre-tax empty-can price, not a live market offer. Full
  can purchases and output sales retain normal pricing; reusable tools and missing
  item records never become empty-can inputs. Existing craft-board per-recipe
  custom input costs remain authoritative, and stale saved routes remain explicit.
  Clearing the value restores normal ingredient pricing. The reviewed item scope
  lives in [empty-value](../src/lib/price-calculation/empty-value.ts).
- Flea access uses the active player's level and the item's `onFleaMarket` and
  `minLevelForFlea` metadata, with a minimum player level of 15. Locked flea
  purchases remain the displayed fallback but cannot supply nested recipes.
  Manual prices remain explicit overrides.
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
- When an ingredient has no trader, barter, or craft acquisition method, a usable
  sale value remains available as a manual **(sell value)** opportunity-cost route:
  the money forgone by consuming a primarily found-in-raid item instead of selling
  it. The page still defaults to flea, even when flea is locked or unpriced, and
  never automatically switches back to sell value. If the selected route cannot
  be priced, dependent profit figures remain null. Unstable estimates continue to
  price both recipe inputs and outputs. `sellValueIsEstimate` marks a selected
  unstable flea sale; `sellSourceLabel` names the selected source. Manual sales
  and selected trader sales do not carry the instability warning.
- Output sale text turns yellow with a small warning icon; hover or keyboard
  focus shows **Value unstable** in a compact overlay. There is no row-wide warning.
  Ingredient flea purchases show small **(value unstable)** text beside their
  prices on profit pages; modal crafting/barter ingredients instead show a yellow
  `~` total with a **Value unstable** tooltip. Manual buy overrides and non-flea
  routes do not carry this warning. The item modal market
  estimate uses small **value unstable** text without an icon or popup. Sale value, profit and
  profit/hour all use the same estimate, including after ingredient-route changes.
  Route profit and owned-input opportunity value remain distinct.
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
  Craft profits do not include fuel; the station page's power model (below) owns
  fuel burn and the skill's fuel effect.
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
remove unlock requirements. These checks also apply recursively to ingredient routes. The
optimizer selects the next usable source and retains locked alternatives for manual
inspection with explanatory reason rows. When no usable source remains, flea is
the displayed fallback even if locked. Players may explicitly select a locked
source to view its known hypothetical cost and recipe chain, but locked sources
never become eligible recursive inputs. Sell value is offered only when no trader,
barter, or craft method exists, and selecting it is retained by the page's route
selection. If the selected route cannot be priced, ingredient costs and dependent
profit figures remain unknown; the Cost cell names the unpriced ingredients
(**No price: …**) in red.

Outputs that cannot be sold on the flea list **No flea sale** in the row's
requirements, even when they can be sold to a trader. The vendor fallback option uses the best
trader sale by default; disabling it leaves locked output sales unpriced unless
there is a manual sale override. Owned-input opportunity values always use usable
sales, independently of the output fallback option. The master **Hide locked
recipes** filter covers recipe locks, flea output locks, and unavailable ingredient
routes. Separate filters hide flea-sale, quest, vendor, or station locks. These
options persist per app mode and are shared by both profit pages, independently
of saved progress and price overrides. The menu groups list filters, availability,
output valuation, and ingredient sources. **Hide locked recipes** is off by
default; an explicitly saved per-mode choice is retained.
**Prefer best craft/barter route even if locked** is off by default. Enabling it
selects cheaper priced locked ingredient recipes using the existing practical savings
threshold, retaining their lock reasons and hypothetical costs. Explicit ingredient
route selections still take precedence; disabling the option restores accessible
automatic recommendations. This page preference does not change recursive optimizer
eligibility.
An explicitly linked recipe remains visible with its lock reasons so its profit
breakdown can still be inspected.

### Lock presentation

Locks are a normal state, not an error, so rows stay compact and quiet. Source
and output share one **Recipe** column: the output (image, name, quantity, sale
price) leads, pin and recipe-chain controls sit at its top-right, and one
truncated requirements line runs underneath. That line shows the station/trader
icon with its required level, then every requirement joined by dots, prefixed by
an amber lock (red when data or a route is missing).
[RecipeRequirements](../src/features/profit-pages/components/RecipeRequirements.tsx)
opens a grouped list of all requirements (recipe, selling the output, each
ingredient) on hover, keyboard focus, or click. It stays open while the pointer is
inside, so quest links remain clickable; an outside press, Escape, or scrolling
closes it. On wide screens ingredient lines show only a small lock icon whose
title repeats their reasons; compact cards use an expandable row instead.

Hovering an item opens a short card; the item dialog holds the full detail. For
ingredients it shows the route chip (route icon inline with its label, or
**Tool**) and its source (trader LL and non-rouble price, barter/craft source),
price per unit, total, its share of the recipe's total cost (the ingredient's
total, not its unit price; hidden for tools or when the recipe cost is unknown),
craft/barter savings versus the cheapest direct purchase (**Saved vs flea** or
**Saved vs trader**), and route time. When the selected route is locked, a
**Locked reason** section lists only that route's gates in plain language (flea
unlock level, required LL or station level with the player's current level,
linked unlock quest); recipe routes list only their own station/trader/quest
gates, not ingredient or tool gaps. Outputs show sale price, flea listing fee,
best trader offer and net proceeds. Craft and barter routes add the recipe
preview (source, level, ingredients, time and total) to the same card, divided
by a vertical rule. A locked recipe rejected before pricing still previews its
ingredients, priced from direct flea buy prices as if they were available.

[lock-summary.ts](../src/features/profit-pages/utils/lock-summary.ts) derives the
line and groups: one entry per requirement (station and level, trader LL, quest,
highest flea level, **No flea**/**No flea sale**), dropping generic "no route"
summaries when a specific reason exists. Ingredients contribute only their
selected route's reasons; the optimizer's aggregate ingredient reasons (all
locked alternatives and nested recipes) remain unchanged for filters and the
route menu. Lock reasons carry optional `sourceId` and `requiredLevel` for this
presentation.

While the **Hide locked recipes** filter is off, a banner in a collapsible
`FilterDrawer` under the filter bar lists profile-wide gaps once: player level below
the flea unlock, unset hideout levels (crafts), and all traders at LL1. Each gap has
its own action: **Set PMC level** opens the navbar character panel
(`openCharacterPanel`), **Set hideout levels** links to the hideout page, and
**Set trader levels** opens [TraderLevelsModal](../src/features/profit-pages/components/TraderLevelsModal.tsx),
which shares [TraderLoyaltyControl](../src/components/entities/trader-loyalty.tsx) with
the quest trader filter. A **Hide locked** shortcut follows. Flea requirements at
the general unlock level are omitted while the banner explains it.

Locked dropdown choices retain the
normal item/source/price layout, with a subtle red border and a reason header that
owns the lock icon. Item labels prefer short names, source details use readable
secondary text, and the recommended route is marked **Best** with a crown above
any lock reasons. Display-only locked prices use known flea/trader offers or
eligible ingredients for a hypothetical recipe; they never make a route eligible.
Unknown route costs remain dashes. When an inaccessible recipe contains priced
but locked ingredients, its display-only effective price recursively totals their
known acquisition estimates without making either route eligible.

Acquisition method colors are independent roles in
[globals.css](../src/app/globals.css): `acquisition-craft` (orange),
`acquisition-barter` (blue), `acquisition-trader` (purple), `acquisition-flea`
(emerald), and `acquisition-sell-value` (yellow). Profit rows, route selectors,
recipe previews and item-detail method badges share these roles. Status warnings,
profit signs and charts retain their own palette.

Ingredient route controls use a solid method-colored border for a manual selection
that differs from the recommendation. A dashed border identifies an automatic
fallback only when a priced locked alternative would beat the selected route,
respecting the practical savings threshold for recipes versus direct purchases.
The initial best route is borderless; merely having alternatives (locked or usable)
does not add a border. Unknown locked prices cannot establish a fallback. Tooltips
report available/locked source counts and explain marked fallbacks.
Ingredient controls have no muted background or divider lines between ingredients.
Profit ingredient rows prefer item short names while keeping full names in their
hover text. Reusable tools show their tool badge without a quantity, separator,
or price text. Customized prices have a dashed underline and a reset arrow that
immediately restores the normal price for that item and side (buy or sell).
Output tint fills the cell height while the item details stay at the top; locked
outputs use a faint amber tint instead of the brand tint.
Automatic recommendations still exclude locked sources; the existing ingredient
source toggles control whether crafts and barters participate.

[ProfitPageClient](../src/features/profit-pages/ProfitPageClient.tsx) owns filters,
evaluation, selection, and modal navigation. [Components](../src/features/profit-pages/components/)
render sorting, source/availability filters, recipe chains, route alternatives,
price inputs, and recipe previews. Barters default to descending profit; crafts
default to descending profit/hour.
Both routes compose [ProfitPageControls](../src/features/profit-pages/components/ProfitPageControls.tsx)
from the shared [filter bar kit](../src/components/ui/filter-bar.tsx): local output
search, trader multi-selection, Options/Skills triggers, and the pinned-crafts toggle.
Options uses shared panel sections and checkboxes; Skills retains its specialized
validation and dialog. Escape closes Options and restores trigger focus.
Options also offers **Show top only**, with a 1–5 per-station (crafts) or per-trader (barters) limit (default 2;
the filter starts off). It ranks filtered barters by baseline profit and crafts
by baseline profit/hour, independently of display sorting and manual overrides.
Direct recipe links remain visible even outside the limit. **Ignore player level**
omits player-level gates from recipe calculations and sale/ingredient details;
flea item bans, quests, trader loyalty and station requirements still apply.
The navbar level input keeps a local draft and writes through the existing profile
action after 500 ms without another edit. Empty drafts do not change saved levels;
profile changes or external level updates cancel pending writes.
The [multi-select dropdown](../src/components/ui/filter-multi-select.tsx) supplies
the trigger/menu and checkbox-row interactions, including keyboard navigation,
disabled rows, and remaining open after selection. The profits feature supplies
station row content (icons, names, levels), selected IDs, the All stations reset,
and the rule disabling unbuilt stations when hiding locked recipes. An empty
station selection still means all stations. Barters use the same dropdown for traders,
with trader portraits supplied by the profits feature. Selecting multiple traders
includes recipes from any selected trader; an empty selection means all traders.
Selections remain local to the page. Calculation rules and persistence keys are unchanged.
At viewport widths below 1024px, both lists use compact cards with separate
sort buttons for cost, sale proceeds, profit, and profit/hour. Each card places
the Recipe cell above its ingredients and a stacked list of cost, sale proceeds
(with a short source name), profit (with duration) and profit/hour. Rows without
a value are omitted, and the last remaining row is emphasised. Unpriced
ingredients are named above the list. The requirements line keeps the lock and
source and ends with an underlined **Requirements** link that expands the
grouped list inline instead of opening the popup. Ingredient lines are two
fixed-height lines: the name, then quantity, price, route savings and time.
Ingredients with locks or a barter/craft route show lock, tree and chevron
badges; tapping the row (not the route switcher or item image) expands it to
list lock reasons, nested ingredients and a **View craft/barter** link. Compact
cards have no bordered buttons: the pin is a bare icon, and the card-level
recipe-chain toggle and per-ingredient recipe buttons are desktop-only.
Every collapsed card block has a fixed height so `estimateProfitRowHeight`
matches the rendered card and window virtualization does not jump while
scrolling. The Recipe cell has no border accent in cards; output lock
reasons instead give the entire card an amber border. On every width, a small
**Top** chip floats at the bottom center once the page scrolls past one
viewport and returns to the top, without smooth scrolling under reduced motion.
Row actions put the recipe-chain toggle before the pin, so the pin keeps its
position. On wide screens the toggle expands every barter/craft ingredient in
place: its nested ingredients render directly beneath it, indented per depth,
with quantity and route on the name lines and cost and time right-aligned.
Wider screens retain the table; the Recipe column is marked by a 2px brand-colored
left border rather than a background tint. Below 1280px the
figure columns use fixed widths that fit the 1024px container, leaving the rest
to required items. Row content aligns to the top so the output name, first
ingredient and figures share one reading line. Both layouts share row controls,
price comparisons, recipe links, and measured window virtualization.
List ordering uses the current market-price evaluation as its baseline, so manual
buy or sell overrides recalculate a row without moving it. Editable customized
item prices use blue text. Profit and profit/hour retain their normal signed
green/red color and stack below the crossed-out baseline value for comparison.
[useManualPriceOverrides](../src/features/profit-pages/useManualPriceOverrides.ts)
and [usePinnedCrafts](../src/features/profit-pages/usePinnedCrafts.ts) persist
independently by app mode; key and reset semantics belong to [user state](user-state.md).

[ItemDetailRecipeProfit](../src/features/items/item-detail/ItemDetailRecipeProfit.tsx)
uses the same engine with a bounded acquisition tree. Recipe links navigate to
the corresponding profit row; standard ingredients open the item-detail dialog.
When extending calculations, update the engine and consumers together so an item
page and a full profit page do not disagree for the same inputs.

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
modeled in recipe profit.

## Generator fuel and Bitcoin Farm

The station page's streamed recipe slot
([StationRecipeSections](../src/features/hideout/details/crafts/StationRecipeSections.tsx))
adds a Generator row and Bitcoin calculator on the Bitcoin Farm and a Fuel breakdown on
the Generator, above Crafts. They wait for the saved profile like crafts, reuse the
shared recipe query and calculator. Installed GPUs,
stored coins and coin progress are page-local inputs.

The Bitcoin Farm shows all 50 GPU slots in a compact grid, with only the saved
level's capacity enabled (10/25/50). Locked slots are muted, empty slots dashed,
and installed cards softly colored with chip dots. Hover or keyboard focus previews
the change without changing production: additions have dashed green borders and no
dots; cards to be removed have dashed red borders. Clicking an empty slot fills
through that slot; clicking any installed slot removes it and every card after it.
A grouped number field and equal-height
minus, plus, Max and Clear controls sit beside the grid and wrap on narrow screens.
Stored coins, current-coin progress and the full-storage estimate sit below the GPU
input. These controls appear once at least one card is installed.
At zero cards, production statistics remain visible with dashes.
The GPU controls share the top row with a Bitcoin value summary using the item
modal's 512px image, without a trader caption. Four borderless statistics show time
per Bitcoin, Bitcoin per day, hourly revenue and payback for the installed GPUs.
Revenue and payback explicitly exclude fuel costs; the extra-card payback and
investment statistics are not displayed. There are no divider lines around the stats.

The Generator row leads with a borderless, softly shaded fuel-burn summary. Its
station portrait sits beside the hourly rate, with daily usage and Solar below.
The summary centers its contents and stretches to the fuel comparisons' height.
The Generator station page adds a **Fuel** section below the shared row: four headline
tiles (how long full tank slots last, cheapest fuel per day, tanks burned per week, cost to
fill every slot) that sit in one row, a 2×2 grid or a single column depending on the panel's
width. A **Modifiers** strip, headed by the net change vs. the base burn, shows buff (green)
and debuff (red) chips for built Solar Power, the Defective Wall and Hideout Management, plus
dashed ghost chips for **Available upgrades** (units and roubles saved). Station chips link to
their station. Beside it on wide panels (below it otherwise) is a running-cost table (how
long one tank lasts, then cost per hour/day/week) with the cheapest tank highlighted.

The **Configure** button in the Generator row opens one dialog with Hideout Management and
a section per fuel can. Each section has a rouble input with Save and Reset (drafts stay
local until Save; dismissing discards them) and the can's acquisition routes as a radio
list: unlocked routes cheapest first, then locked ones with their first lock reason,
the recommended one marked **Best**. Picking a route sets that can's cost; **Use
recommended** clears the pick. A saved route that is no longer available leaves the
can unpriced until another is chosen; it never falls back silently. The sale value is
saved for the active profile across the app. The entered amount is the pre-tax sale price and is saved unchanged. An
always-visible estimated flea tax row shows a dash for blank/invalid input and
Unavailable when the item base value is missing. The shared empty-sale model uses
the profile's Intelligence Center, Hideout Management and trader loyalty settings;
net residual value is clamped to zero when tax exceeds the sale price. Missing tax
inputs leave residual value and dependent costs unknown, never gross-as-net.
Blank/reset removes the value and zero remains valid. Full-can purchase prices
remain visible. Running costs use
`max(0, purchase cost - net empty proceeds)` divided by runtime, always labelled
**Cost / hour**. Generator daily/weekly costs and upgrade savings share this
deduction. Unknown purchase prices stay unknown.
The two tanks use borderless comparisons with larger item images, aligned numeric
runtimes and hourly costs; the cheaper hourly option gets a small downward arrow
and a soft success wash only when
both costs are available and differ. Longer runtime does not imply better value.
A built Solar Power bonus appears in the generator summary with its portrait and
base efficiency percentage. There is no fuel-remaining
input or power-out reminder; the Bitcoin timer estimates only when storage fills.
Hideout Management in the Configure dialog uses the existing mode-scoped profit options,
including Elite, shared with crafts and profit pages. Chosen fuel routes are the only
new saved field: `tarkov-fuel-routes-v1:{mode}`.

- [hideout-power-model](../src/features/hideout/power/hideout-power-model.ts): base
  burn is constant (~4.75 units/h, independent of active stations). Built
  `FuelConsumption` bonuses stack across levels (Solar Power −50%; Defective Wall
  +5% per stage 2–5, cancelled at stage 6). Burn multiplier =
  (1 + Σ bonuses × (1 + 1% × HM)) × (1 − 0.5% × HM), HM capped at 50. Slot counts
  sum built `AdditionalSlots` for an item (GPUs 10/25/50, fuel tanks 2/4/6).
- [bitcoin-farm-model](../src/features/hideout/power/bitcoin-farm-model.ts): time per
  coin = base / (1 + (GPUs − 1) × 0.041225); the farm stops at 3 stored coins.
  Revenue/hour is gross, without deducting fuel. ROI = GPU investment ÷ revenue/hour;
  the model also exposes the constant marginal payback for an extra card.
  The storage timer assumes continuous power until the farm fills.
- Prices: GPUs use the optimizer's recommended acquisition, and fuel tanks the same unless a route was chosen in Configure; Physical
  Bitcoin (flea-banned) uses the highest valid current trader buyback from `sellFor`,
  with no flea fee. Crafting's locked-output trader toggle and manual sale overrides
  do not change this value. The offer is mode-specific, not a hardcoded price;
  missing trader offers remain unavailable. Missing items, prices or bonus data
  render explicit notices. Constants without a data feed live in
  [hideout-power](../src/lib/cfg/hideout-power.ts).

## Craft planner

[CraftPlannerClient](../src/features/profit-pages/optimize/CraftPlannerClient.tsx)
continues to load the shared bounded profit query, profile unlocks, skill settings,
manual prices, and both recipe graphs. It mounts
[StationBoard](../src/features/profit-pages/optimize/StationBoard.tsx), replacing
the previous continuous scheduling panel and its temporary selections.

The board uses horizontal station rows with output, duration, required inputs,
gross sale price per output, net batch profit, profit/hour, pin and detail actions.
[StationCraftRow](../src/features/profit-pages/optimize/StationCraftRow.tsx) renders
each craft and its expanded content; the board owns selection, pins and ranking.
Details compose [StationCraftIngredient](../src/features/profit-pages/optimize/StationCraftIngredient.tsx)
for each ingredient and [StationCraftPriceField](../src/features/profit-pages/optimize/StationCraftPriceField.tsx)
for input and sale price editing, using the existing callbacks and saved choices.
Smaller screens wrap the rows. Each station initially shows all profitable crafts;
players can hide unpinned rows or include unprofitable crafts. Ranking
offers profit/hour, batch profit, long runs, and easy inputs (distinct purchase
sources plus intermediate craft/barter steps). Profit/hour assumes prompt
restarts and includes allocated intermediate craft time, not an automated queue.
The top three profitable, available crafts in each station display gold, silver,
and bronze rank markers for the active recommendation order.
Changing an ingredient approach, route, or custom price updates the row in place
without changing its visibility or position. Ranking is based on the evaluation
captured when the page is opened; pinning moves crafts into the pinned group.
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
10% return target and optional acquisition steps live here.

Expanded details use a borderless two-column layout (stacked on phones), with
ingredients beside sale, costs and profit. Source names share the unit-price
editor; custom prices stay blue and expose a reset arrow. Alternatives within
10% of the cheapest source appear inline, while other sources remain selectable
from the source menu. This comparison uses estimates before recipe-specific
custom prices, so editing a price does not rearrange source choices. Inline
prices are per unit; item totals and menu totals include the required quantity.
Profit is emphasized, with smaller costs and estimated price targets beneath it.
Price-edit guidance and calculation notes are expandable; lock reasons, missing
routes and unavailable fee estimates remain visible. Expanded details leave
28px before the next craft; the craft row itself is unchanged.

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
node --test --import jiti/register src/features/profit-pages/optimize/station-craft-details-model.test.ts
node --test --import jiti/register src/features/hideout/power/hideout-power-model.test.ts src/lib/price-calculation/prices.test.ts
```

Include tests for the changed route/availability/pricing rule and browser checks
for affected table sorting, overrides, pins, recipe links, and mode switching.

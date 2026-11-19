# Battle-pass purchase planning

## Document route

In **Battle Pass → Docs Breakdown**, turn on **Optimizer** (off by default) to calculate routes and show claiming-profile recommendations on reward cards. Reward cards in the route show **Claim #N**, their position in the claim order, and **Claim suggested** claims those rewards on a page. With the optimizer off, no rewards are suggested. Then select a final-page reward, a saved goal, all saved goals, or **Finish the season**. In the required-rewards scope, finishing means claiming the final page and enough prerequisites to reach it. Select **All rewards through destination** with **Finish the season** to buy every outstanding reward. The controls recalculate the preview as inventory, costs, and selections change.

To see how far current inventory can take you, choose **Most rewards with owned documents**. Each new page requires all but one reward on the preceding page. Already claimed rewards count toward the gate across all profiles.

Each claim draws ordinary documents from one profile. Including all profiles lets the solver assign different claims to different inventories. A higher-priced prerequisite can be cheaper to fund when its document types match stock on hand. Turning on **Use classified** lets the solver spend the season’s shared classified balance after matching ordinary documents. The breakdown summarizes the configured route. Inventory coverage includes matching ordinary documents and any enabled owned classified documents. Each claim shows ordinary stock allocated to it after earlier claims, divided by its required quantity. The cash-free estimate finds the fewest full daily gathering allowances needed for that claim order using allowed documents, parallel profile caps, existing TarCoins and rewards earned before each purchase. Select **Show documents** in the **Fastest cash-free finish** tile to see the cumulative document quantities to gather in each mode over those days.

### Preferred gathering mode

With **All profiles** on, **Route configuration** shows a card per mode with its daily cap, owned documents, claims in the route and documents to gather for the fastest cash-free finish. Select a card to make that mode preferred; select it again to clear the preference. After the route is solved, each claim moves to the preferred mode whenever that costs nothing: the same rewards and claim order, no classified document needed earlier and no claim lost from ready now. Gathering follows the claims, so the cash-free days change with the mode's daily cap. **Advanced: modes and documents to gather** is always shown, also when only one profile is included. It turns gathering off per mode or per document type; a mode turned off has its claims moved to other modes when that is free, and owned documents still count. These choices also drive **Save cash by gathering**. The summary below the cards updates live. Model: [owner-preference-model.ts](../src/features/battle-pass/lib/owner-preference-model.ts).

## Funding the route

In **Route configuration**, enter the current global TarCoin balance and enable the one-time offer if it is still available. The breakdown stays hidden until a complete route can be calculated; claim order, funding and gathering savings are collapsed sections whose headers show the reward count, cash total and best saving. The cash recommendation lists the quantity, price per TarCoin pack, and subtotal for each pack size. The subtotals add up to the cash needed for the selected claim order. The schedule then shows how to spend those TarCoins on classified documents. Reward TarCoins become available after the corresponding claim. The optimizer finds the exact minimum cash cost, then recommends the most TarCoins within 10 cents of that amount. If the recommended purchase costs more, the receipt also shows the exact-minimum purchase and its ending balance. Gathering savings compare actual recommended purchase prices. The receipt and each gathering breakpoint also compare the cheapest higher-priced single bundles that provide more currency, showing the ending wallet for the same document purchases.

**Save cash by gathering** shows how additional ordinary documents would change that receipt. Each alternative starts from current inventory and keeps the same rewards, claiming profiles, and order. The highlighted recommendation lists quantities by mode. Under **Route configuration → Advanced: modes and documents to gather**, turn off a mode or individual document types to recalculate gathering. Choices are saved on this device per profile, including each seasonal character. Turning a mode back on restores its document selections. Owned stock and reward claims still count in every mode. Gather the cumulative quantities in a single row to reach its cash total. The list ends before gathering would fully cover the route. A row can still cost $0 when an existing TarCoin balance or reward income covers the remaining documents.

**Step-by-step plan**, below the gathering savings, lays the active route out left to right, just in time. Classified purchases split the claims into runs. Before each run you gather that run's ordinary documents per mode, buy TarCoins only when the next classified pack is unaffordable, and buy classified packs only when a claim needs them. Packs keep the funding plan's order and are never bought earlier than planned, so reward TarCoins earned along the way always cover them. TarCoins the purchase adds beyond the claims appear last as **Buy TarCoins to keep**. Choose **No gathering** or any gathering option; the recommended one is selected by default. Each choice reprices the same claim order. Model: [purchase-flow-model.ts](../src/features/battle-pass/lib/purchase-flow-model.ts).

Each profile has a separate acquisition limit across all document types in a 24-hour period. PVP can collect 25, PVE can collect 15, and a seasonal character can collect 40. The estimate assumes the full allowance is available on each listed profile and counts periods in parallel. Edit these values in [gathering-caps.ts](../src/features/battle-pass/lib/gathering-caps.ts).

| Classified documents | TarCoins |
| ---: | ---: |
| 20 | 500 |
| 40 | 950 |
| 75 | 1,680 |
| 250 | 5,000 |
| 500 | 8,750 |

| TarCoins | USD |
| ---: | ---: |
| 500 | 4.99 |
| 1,100 | 9.99 |
| 2,300 | 19.99 |
| 6,000 | 49.99 |
| 12,500 | 99.99 |
| 20,250 | 149.99 |
| 2,000 (once) | 9.99 |

## Route options

**Route options** compares viable claim routes and TarCoin purchases. The route planner minimizes documents first, so a route with one more document can still be better when it earns reward TarCoins. For example, on page 08 TarCoin ×50 costs one more document than White accent walls. Depending on the wallet and inventory, that swap can avoid a larger pack, leave more TarCoins for the same checkout or cost more.

After the active route is calculated, a background worker solves the same route model again for each higher total of reward TarCoins. It keeps the fewest-document route at each level, buys at most 20 more classified documents than the active route and prefers the active route's rewards when choices tie. A route with more documents and no more reward TarCoins never costs less, so these levels cover every route worth comparing. Wallet and offer changes only reprice the routes; they do not re-solve.

Each route lists TarCoin purchases up to $10 above its minimum that leave more TarCoins after the pass. **Show more options** under a route adds one purchase: the cheapest single regular pack (with the one-time offer when it is enabled) that funds the route and costs more than the listed purchases. **Show fewer** hides it again, and it resets when the routes are recalculated. Purchases within 10¢ of each other form a price tier, which keeps the one leaving the most TarCoins; the cheapest tier also keeps the exact minimum. An option is hidden when another option costs no more, buys no more classified documents and leaves at least as many TarCoins. The section shows one card per route: the optimizer route first, then each alternative with its reward swaps and classified documents to buy. Each card lists its purchases with the pack receipt, the cash paid now and the TarCoins left. Each purchase states the difference from the cheapest checkout of the optimizer's route, such as “Spend $0.01 more and keep 100 more TC”. The active route's recommended purchase is marked as the one shown in Route funding.

Each route card first shows its **Classified documents**: the document packs each listed purchase leads to, the total TarCoins they cost, spare documents and when to buy each pack in the claim order. It compares them with the cheapest packs if every TarCoin were available up front; a difference means the purchase must wait for TarCoins earned along the claim order. Purchases that share the same packs and timing share one entry. The TarCoin purchases follow. The section sits above Route funding because the claim order does not depend on how TarCoins are bought.

**Use this route** makes claim markers, claim order and funding follow that route. The choice is not saved: it ends when any route setting changes or the page reloads. Model: [route-options-model.ts](../src/features/battle-pass/lib/route-options-model.ts).

# Battle-pass purchase planning

## Document route

In **Battle Pass → Docs Breakdown**, select a final-page reward, a saved goal, all saved goals, or **Finish the season**. In the required-rewards scope, finishing means claiming the final page and enough prerequisites to reach it. Select **All rewards through destination** with **Finish the season** to buy every outstanding reward. The controls recalculate the preview as inventory, costs, and selections change.

To see how far current inventory can take you, choose **Most rewards with owned documents**. Each new page requires all but one reward on the preceding page. Already claimed rewards count toward the gate across all profiles.

Each claim draws ordinary documents from one profile. Including all profiles lets the solver assign different claims to different inventories. A higher-priced prerequisite can be cheaper to fund when its document types match stock on hand. Turning on **Use classified** lets the solver spend the season’s shared classified balance after matching ordinary documents. The breakdown summarizes the configured route. Inventory coverage includes matching ordinary documents and any enabled owned classified documents. Each claim shows ordinary stock allocated to it after earlier claims, divided by its required quantity. The cash-free estimate finds the fewest full daily gathering allowances needed for that claim order using allowed documents, parallel profile caps, existing TarCoins and rewards earned before each purchase. Select **Show documents** in the **Fastest cash-free finish** tile to see the cumulative document quantities to gather in each mode over those days.

## Funding the route

In **Route configuration**, enter the current global TarCoin balance and enable the one-time offer if it is still available. The breakdown stays hidden until a complete route can be calculated; claim order, funding and gathering savings are collapsed sections whose headers show the reward count, cash total and best saving. The cash recommendation lists the quantity, price per TarCoin pack, and subtotal for each pack size. The subtotals add up to the cash needed for the selected claim order. The schedule then shows how to spend those TarCoins on classified documents. Reward TarCoins become available after the corresponding claim. The optimizer finds the exact minimum cash cost, then recommends the most TarCoins within 10 cents of that amount. If the recommended purchase costs more, the receipt also shows the exact-minimum purchase and its ending balance. Gathering savings compare actual recommended purchase prices. The receipt and each gathering breakpoint also compare the cheapest higher-priced single bundles that provide more currency, showing the ending wallet for the same document purchases.

**Save cash by gathering** shows how additional ordinary documents would change that receipt. Each alternative starts from current inventory and keeps the same rewards, claiming profiles, and order. The highlighted recommendation lists quantities by mode. Under **Modes and documents to gather**, turn off a mode or individual document types to recalculate gathering. Choices are saved on this device per profile, including each seasonal character. Turning a mode back on restores its document selections. Owned stock and reward claims still count in every mode. Gather the cumulative quantities in a single row to reach its cash total. The list ends before gathering would fully cover the route. A row can still cost $0 when an existing TarCoin balance or reward income covers the remaining documents.

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

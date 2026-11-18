# Battle Pass document configuration

Status: proposed for validation against Season 2. The shipped viewer supports browsing rewards, selecting goals and recording claims. In Season 1 (KORD), players can rely on a reward's total cost and number of distinct document types. Its document types and the quantity of each must come from the player's game.

## Entering a reward cost

1. In edit mode, show one dashed slot with a plus icon for each required type. Start unconfigured rewards with empty slots.
2. Selecting a slot opens the full document list upward. Selecting a document displays it beside an immediately focused quantity input.
3. Enter a positive whole quantity and press Enter to save and collapse the slot. Reopening a slot allows corrections. Keep partial entries as drafts.
4. A reward is configured when its slots contain the required number of distinct types and their quantities add up to its known total. If either check fails, show what remains to fix.

## Planning and season scope

Use the configured reward costs for the detailed document view, inventory coverage, classified estimates and per-profile purchase assignments. A plan with any unconfigured required reward, including a suggested prerequisite, can show its total price but cannot claim a verified document breakdown or spend against inferred costs.

Persist entries locally by season ID and stable reward ID. All profiles share that season's reward configuration. The next season starts with empty slots; old entries stay with their original season. Existing type swaps do not establish verified quantities. Confirm the invariants against the live Season 2 rewards before implementing this flow.

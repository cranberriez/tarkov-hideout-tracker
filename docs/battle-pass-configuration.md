# Battle Pass document configuration

Status: Season 1 cost setup is implemented. Season 2 remains a test placeholder;
validate its reward totals and type counts against live rewards before replacing
the copied data. In Season 1 (KORD), players can rely on a reward's total cost and
number of distinct document types. Its document types and quantities come from
the player's game.

## Current read-only overview

The document locations panel above the rewards shows each map's document types,
with Columns and Table views. Document map opens the maps index with the Documents
preset; map headings in Columns view open that map with the same preset in the
currently selected game mode.
The square arrow beside the heading collapses the locations content while keeping
the heading, spawn summary and Document map link available. It starts collapsed
unless the shared Battle Pass `showMaps` preference records an expanded panel.
Toggling persists across visits and reloads; the selected view stays local to the panel.

Season 1 ends Monday, December 7, 2026 at **1:00 AM Pacific Standard Time**
(`America/Los_Angeles`), stored as `2026-12-07T09:00:00Z`. The banner explicitly
displays Pacific time; Season 2's end remains unannounced.

The banner shows remaining total document costs for Everything and, when goals
are selected, Goals including the cheapest outstanding prerequisites. Claimed
rewards are excluded. The orange “Classified only” row shows the alternative
cost of paying entirely with classified documents at 1:1, before owned inventory.
It does not infer a document-type breakdown or an inventory-adjusted shortfall.
Plan scope and List view use matching 40px-tall rounded, borderless buttons with
14px labels and a muted surface fill, tinted brand when selected. The Plan label
also uses 14px text, with a separator before List view.
An advisory above the rewards explains that document types vary between players;
its emphasized Setup Costs action opens a local draft. In setup mode the advisory
replaces the advisory with scope validation and Save/Cancel controls. Validation
appears only while editing, with foreground text and a red warning or green check
icon on a normal card surface. A faint matching glow fades out over the left 20%.
The reward artwork, bento layout and card dimensions remain unchanged. Compact
document slots sit inside each unclaimed card beneath its title, filling a row
with up to six slots before wrapping. Document types are represented by icons
in the picker, slots, saved costs and summaries. Duplicate types or quantities
exceeding the reward's total replace its document-total label with an error;
empty or underfilled slots have no per-card warning text and still leave the
scope unconfigured. Goal and claim actions remain visible but disabled during setup.
Cancel asks for confirmation only
when there are unsaved changes. Claimed rewards need no setup and cannot be edited.
Previous/Next controls and their Q/E key hints sit below the reward pages.
The fixed minimap stays above page-transition snapshots and document pickers.
Pages with any unclaimed reward whose costs are not fully set show a yellow warning
icon in place of their lock/goal icon. Duplicate types or excess quantities take
priority and replace that warning with a red “!”, including errors on pages outside
the visible spread. Claimed rewards do not need setup. Pickers reserve space above
the minimap; document slots and inline quantity inputs stay 32px tall.

## Entering a reward cost

1. In edit mode, show one dashed slot with a plus icon for each required type. Start unconfigured rewards with empty slots.
2. Selecting a slot opens the full document list upward. Selecting a document displays it beside an immediately focused quantity input.
3. Enter a positive whole quantity and press Enter to save and collapse the slot. Reopening a slot allows corrections. Keep partial entries as drafts.
4. A reward is configured when its slots contain the required number of distinct types and their quantities add up to its known total. If either check fails, show what remains to fix.
5. Save retains partial entries for later correction. Clear in the document picker removes a slot's entry.
   Closing a slot does not persist the draft; the banner's Save commits it.

## Planning and season scope

The viewer shows configured costs on individual rewards. A verified plan document
breakdown requires valid costs for every unclaimed reward in Everything, or every
outstanding goal and suggested prerequisite in Goals. The advisory reports how
many required rewards still need costs; unresolved saved goals also block a
verified goal breakdown. Total-only planning remains available during partial setup.
Inventory coverage and per-profile purchase assignments are future consumers of
verified costs; setup and claims never consume documents.

Entries persist in `tarkov-battle-pass-costs-{seasonId}-v1`, by stable reward ID,
shared by all profiles. Each season starts empty and retains its own entries.
Existing type swaps do not establish verified quantities. Save merges only edited
rewards into the latest record, preserving unrelated records and fields; conflicting
edits to the same reward in another tab are reported instead of overwritten.

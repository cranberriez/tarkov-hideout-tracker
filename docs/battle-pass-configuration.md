# Battle Pass document configuration

Status: Season 1 cost setup is implemented. Season 2 remains a test placeholder;
validate its reward totals and type counts against live rewards before replacing
the copied data. In Season 1 (KORD), players can rely on a reward's total cost; the expected
number of distinct document types can be adjusted to match their game. Its document types and quantities come from
the player's game.

## Current read-only overview

The document locations panel above the rewards shows each map's document types,
with Grid and Table views. Grid shows one tile per map: the map image fills the
tile, its name sits top-left, and its document types line the bottom over a dark
gradient. Document map opens the maps index with the Documents preset; map names
in Grid view open that map with the same preset in the currently selected game
mode. Both views end with the Icebreaker/Medical update warning and its sources.
The square arrow beside the heading collapses the locations content while keeping
the heading, spawn summary and Document map link available. It starts collapsed
unless the shared Battle Pass `showMaps` preference records an expanded panel.
Toggling persists across visits and reloads; the selected view stays local to the panel.

Season 1 ends Monday, December 7, 2026 at **1:00 AM Pacific Standard Time**
(`America/Los_Angeles`), stored as `2026-12-07T09:00:00Z`. The banner explicitly
displays Pacific time; Season 2's end remains unannounced.

The banner shows remaining total document costs for Everything and, when goals
are selected, Goals including the cheapest outstanding prerequisites. Claimed
rewards are excluded. The purple “Classified only” row shows the alternative
cost of paying entirely with classified documents at 1:1, before owned inventory.
It does not infer a document-type breakdown or an inventory-adjusted shortfall.
Plan scope and List view use matching 40px-tall rounded, borderless buttons with
14px labels and a muted surface fill, tinted brand when selected. The Plan label
also uses 14px text, with a separator before List view.
An advisory above the rewards explains that document types vary between players;
its emphasized Setup Costs action opens a local draft. The gray, borderless Use Defaults
button to its left toggles the cost source, with a checkmark while active. Defaults
may be incorrect, as the advisory notes when active. Enabling confirms only when
custom costs or type-count overrides exist. Toggling never overwrites custom
records: turning defaults off restores them, including partial entries. The source
selection persists per season. Setup Costs always opens the saved custom draft;
Save selects custom costs and Cancel retains the previous source. In setup mode the advisory
replaces the advisory with scope validation and Save/Cancel controls. Validation
appears only while editing, with foreground text and a red warning or green check
icon on a normal card surface. A faint red glow fades out over the left 20% while setup needs attention.
Once the selected scope is fully configured without errors, the bar uses a neutral
card background, including outside setup; the setup buttons remain available.
The reward artwork, bento layout and card dimensions remain unchanged. Compact
document slots sit inside each unclaimed card beneath its title, filling a row
with up to six slots before wrapping. Document types are represented by icons
in the picker, slots, saved costs and summaries. While editing, incomplete unclaimed rewards show the same yellow warning triangle
as the minimap in their top-left corner. Duplicate types, excess quantities, or
fully filled slots whose numeric quantities fall short show a red “!” and error
text there instead. The document-total label remains visible. Empty or partially
filled slots keep the warning without per-card error text. These notices are
advisory: editing, Save, navigation and later claims remain available; incomplete
costs still cannot supply verified plan totals. Goal and claim actions remain visible but disabled during setup.
Cancel asks for confirmation only
when there are unsaved changes. Claimed rewards need no setup and cannot be edited.
Previous/Next controls and their Q/E key hints sit below the reward pages.
The fixed minimap stays above page-transition snapshots and document pickers.
Pages with any unclaimed reward whose costs are not fully set show a yellow warning
icon in place of their lock/goal icon. Duplicate types, excess quantities or fully entered totals that are too low take
priority and replace that warning with a red “!”, including errors on pages outside
the visible spread. Claimed rewards do not need setup. Pickers reserve space above
the minimap; document slots and inline quantity inputs stay 32px tall.

## Entering a reward cost

1. In edit mode, show one dashed slot with a plus icon for each required type. Start unconfigured rewards with empty slots.
   The cogwheel left of the document total replaces the slots with
   **Document Types: [input] Done**. It starts at the expected count (or saved
   override), accepts whole numbers from 1–10, and Done restores that many slots.
   Increasing retains existing entries and adds empty slots; decreasing retains
   the leading entries. The banner Save commits the override with the costs;
   Cancel discards it. Totals remain unchanged.
2. Selecting a slot opens the full document list upward. Selecting a document displays it beside an immediately focused quantity input.
3. Enter a positive whole quantity and press Enter to save and collapse the slot. Reopening a slot allows corrections. Keep partial entries as drafts.
4. A reward is configured when its slots contain the required number of distinct types and their quantities add up to its known total. If either check fails, show what remains to fix.
5. Save retains partial entries for later correction. Clear in the document picker removes a slot's entry.
   Closing a slot does not persist the draft; the banner's Save commits it.

## Planning and season scope

The viewer shows configured costs on individual rewards using the original compact
artwork-and-quantity chips in the player's saved slot order, with hover labels and
document location menus. Positive whole quantities for recognized saved document
types stay visible even when the reward is incomplete. Such rewards
show Costs incomplete; this never makes them eligible for verified totals. Invalid or empty entries remain saved for correction in Setup Costs.
The **Docs Breakdown** section shows its current scope below the heading and sits below the reward pages and Previous/Next controls,
leaving the area above the rewards for inventory and setup.
A verified plan document breakdown requires valid costs for every unclaimed reward
in Everything, or every
outstanding goal and suggested prerequisite in Goals. The advisory reports how
many required rewards still need costs; unresolved saved goals also block a
verified goal breakdown. Total-only planning remains available during partial setup.
The Document inventory row above Document locations edits ordinary documents for
PVP, PVE, or this pass's seasonal character. Its three profile buttons change only
the inventory being shown and edited; they never switch the active character.
Unactivated seasonal inventories cannot be edited. The selector defaults to the
active profile and stays local to the page. Ordinary counts use the existing
character item inventory (including FiR stock); reducing a total preserves FiR
until non-FiR stock is exhausted. Classified balance and Collect/Use classified
choices remain shared within the season. The document icons retain location menus.

The compact header holds the title, Use classified, and an adjoining, profile-colored PVP/PVE/seasonal button group, wrapping when
needed. The profile buttons match the 32px height of the other header controls.
The square arrow beside the title persists expanded/collapsed state in the shared
`documentInventoryExpanded` preference, defaulting to expanded. Collapsing hides
the document content completely, leaving the header controls available without
extra spacing below the row. The former
compact icon/count summary is commented out pending a visual redesign. Classified icons omit the redundant corner star.
The selected profile uses high-contrast foreground text with its profile
color retained in the border and fill. Classified markers, controls and costs use
the dedicated purple theme color, distinct from ordinary document colors.
Document names and their colored shape marks sit above square artwork;
ordinary artwork is slightly inset while Classified keeps its compact icon.
Titles use compact spacing and shorten blueprints to BP & Tech. Owned inputs have
a border and spacing beneath their labels. Collect controls are flat, borderless,
and subtly tinted by collection state. The row omits repeated plan totals and
setup/editing helper text. With fully configured scope costs, the header shows
covered and missing totals with a bar (also while collapsed), and each type with
a requirement shows Need, its shortfall or Covered, and a thin coverage bar. Avoided types move their remaining
deficit into Classified Need; owned wildcards are allocated once when enabled.
During cost setup, shortfalls are hidden until the draft is saved or cancelled.

The **All** button after the profile buttons is a view, not a profile. Each
ordinary tile shows one owned input per mode (the seasonal input is disabled until
that character is activated), and the header totals and Need bars use the sum of
active profiles.

Claiming or unclaiming a reward only records progress; it never changes owned
document counts, so players keep their numbers up to date themselves. The
[route optimizer](battle-pass-optimizer.md) can show the recommended claiming profile beneath a reward’s completion control.

Entries persist in `tarkov-battle-pass-costs-{seasonId}-v1`, by stable reward ID,
shared by all profiles. Each season starts empty and retains its own entries.
Existing type swaps do not establish verified quantities. Save merges only edited
rewards into the latest record, preserving unrelated records and fields; conflicting
edits to the same reward in another tab are reported instead of overwritten.

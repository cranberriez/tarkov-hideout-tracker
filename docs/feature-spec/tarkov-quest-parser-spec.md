# Tarkov Quest Log Import Feature

This document describes the **implemented** quest log import feature in the quests page.

The original idea started as a parser-only prototype. The current feature now goes further:

- parses EFT logs fully client-side
- classifies quest events as `PVP`, `PVE`, or `unknown`
- shows a two-step import modal
- lets the user optionally auto-complete prerequisite quests
- writes selected quests into the existing persisted quest state

Use this doc as the reference when maintaining or expanding the feature.

---

## Purpose

The feature is meant to help a user:

- upload EFT logs after a play session
- detect quests that were started or completed
- import those quests into the site without using server APIs

It is best used for:

- end-of-session catch-up
- quickly getting back up to speed on the site

It is **not** a perfect replacement for the main quest sync flow. The main sync flow is still better for deeper reconstruction, especially when starting fresh on the site.

---

## Where It Lives

### Main UI

- `src/features/quests/components/QuestLogImportDialog.tsx`

This is the modal UI and interaction flow.

### Parser

- `src/lib/utils/quest-log-parser.ts`

This handles:

- folder/path validation
- file filtering
- log parsing
- raid mode classification
- event deduplication
- quest resolution prep

### Import Helpers

- `src/lib/utils/quest-log-import.ts`

This handles:

- grouping parsed events into importable PVP/PVE quest rows
- filtering out already completed quests
- prerequisite backfill logic
- localStorage seen-file cache helpers

### Entry Point

- `src/features/quests/components/QuestsSyncBar.tsx`

This renders the upload button beside the existing sync button.

---

## High-Level Flow

1. User opens the quests page.
2. User clicks the upload icon beside Sync.
3. A modal opens.
4. User selects the EFT `Logs` folder or one or more `log_*` subfolders.
5. The app validates the selection before parsing.
6. The app filters to only relevant `push-notifications*.log` files.
7. The app skips already-seen relevant files using localStorage-backed file dedupe.
8. The app parses quest events and groups them into `PVP`, `PVE`, and `unknown`.
9. Already completed quests are filtered out of the importable lists.
10. User reviews a mode-specific list and optional prerequisite toggles.
11. User continues to a second review step in the same modal.
12. User confirms import.
13. The selected quests and optional prerequisites are written into the persisted quest state.

---

## Input Rules

### File Picker

The feature uses:

- `<input type="file" multiple webkitdirectory />`

Everything happens in the browser. No files are uploaded to a server.

### Accepted Folder Shapes

The selection must look like EFT logs.

Accepted path patterns are based on `webkitRelativePath`:

- a segment named `Logs`
- a segment starting with `log_`

Examples:

- `Logs/log_2026.05.15_12-30-00/push-notifications_001.log`
- `Logs/push-notifications_000.log`
- direct upload of one or more `log_*` subfolders

### Fast Fail

If the selection does **not** look like EFT logs, parsing stops immediately and the modal shows an error.

This protects against large accidental uploads like selecting a whole drive or an unrelated parent folder.

### Relevant Files

Only files matching:

- `push-notifications*.log`

inside accepted EFT log paths are processed.

All other files are ignored and are **not** cached in the seen-file store.

---

## File Dedupe

### Purpose

The feature avoids reparsing the same relevant files repeatedly across uploads.

### Storage

- localStorage key: `tarkov-hideout:quest-log-import:seen-files:v1`

### What Gets Cached

Only relevant files:

- accepted EFT log paths
- matching `push-notifications*.log`

### Fingerprint

The seen-file fingerprint is based on:

- `name`
- `size`
- `lastModified`

This is intentional because EFT logs are appended while the game remains open. If a file grows, its metadata changes and it will be treated as new again.

### Cache UX

If a selection contains relevant files but all of them are already cached:

- parsing does not continue
- the modal stays on the initial upload state
- the modal shows `No new files seen.`
- a `Clear cache` action is shown under that notice

---

## Parsing Rules

### Trigger Event

Quest events are parsed from lines containing:

```text
Got notification | ChatMessageReceived
```

The parser then reads the following multiline JSON block by tracking brace depth until the object closes.

### Relevant Quest Fields

```text
message.type
message.templateId
message.hasRewards
message.items.data
message.uid
```

### Event Type Mapping

`message.templateId` is split on spaces.

- token 0 = raw quest ID
- token 1 = suffix

Suffix meanings:

- `description` => `started`
- `successMessageText` => `completed`

Numeric `message.type` is authoritative when present:

- `10` => `started`
- `12` => `completed`

If suffix and numeric type disagree, numeric type wins.

### Rewards

Rewards are extracted from `message.items.data` when present.

Captured reward fields:

- item template ID
- stack count
- `SpawnedInSession` when available

### Timestamps

The parser extracts timestamps from the log line that triggered the event.

If a timestamp cannot be parsed, the event keeps `timestamp = null`.

---

## Raid Mode Classification

Each parsed quest event is tagged as:

- `pvp`
- `pve`
- `unknown`

### PVP

PVP is inferred from the most recent prior `UserConfirmed` payload with:

```json
{
  "type": "userConfirmed",
  "mode": "deathmatch"
}
```

### PVE

PVE is inferred from the most recent prior line containing either:

- `wsn-pve-`
- `gw-pve.escapefromtarkov.com`

### Inheritance Rule

The parser scans each file in order and keeps the latest seen mode signal.

Every quest event inherits the most recent qualifying prior signal from the same file.

If no prior signal exists, the event stays `unknown`.

### Unknown Mode

Unknown-mode quests are:

- shown in the Info panel
- never imported

---

## Event Deduplication

The same quest notification can appear more than once across files or in repeated deliveries.

Deduplication is applied within a 1-second window using:

- `questId`
- `type`
- `raidMode`
- timestamp proximity

When duplicates collapse:

- the event remains once in the deduped output
- `occurrenceCount` increases

---

## Quest Resolution

Parsed quest IDs are resolved against the existing `FullQuest[]` dataset already loaded for the quests page.

This means the modal can show:

- quest names
- resolved import rows
- prerequisite chains

Unresolved quest IDs are not shown as a dedicated import list.

---

## Import Buckets

After parsing and resolution, events are grouped into:

- `PVP`
- `PVE`
- `unknown mode`

For `PVP` and `PVE`, multiple event groups for the same quest are merged into one import row.

Each import row tracks:

- quest ID
- quest name
- mode
- whether it was seen as `started`
- whether it was seen as `completed`
- occurrence count
- event count
- latest timestamp
- source files

---

## Already Completed Quest Filtering

Before rendering importable quest rows, the feature removes any quests already marked complete in the persisted user store.

This affects:

- step 1 importable PVP/PVE sections
- step 2 review screen

If new relevant files are found but all importable quests are already complete:

- the modal stays on the initial upload state
- it shows `All quests in logs are already completed.`

---

## Modal UX

### Step 1: Selection

The first modal step shows:

- upload prompt
- optional file/cache notices
- importable `PVP` section
- importable `PVE` section
- optional Info panel

Each quest row shows:

- quest name
- quest ID
- started/completed badge
- `Already Complete` badge if applicable before filtering in related contexts
- seen/event/file metadata
- `Auto-complete prerequisites` toggle

### Network Provider Warning

Quest ID:

- `625d6ff5ddc94657c21a1625`

If that quest row is present and its prerequisite toggle is enabled, the row shows a warning:

> WARNING: If you got Network Provider - Part 1 from the story missions, do not select it. This can auto-complete a large number of quests you may not intend to do.

### Step 2: Review

Clicking `Continue with PVP Quests` or `Continue with PVE Quests` moves the modal to a second review step.

This review step is mode-specific and invalidates the other mode for that import pass.

The step shows:

- chosen mode
- list of quests to import from logs
- list of prerequisite quests that will be auto-completed
- Back button
- Confirm Import button

### Info Panel

The Info button reveals a debug panel containing:

- parser statistics
- unknown-mode quests
- raw deduped events table

---

## Import Behavior

### Mode Selection

The user imports one mode at a time:

- `PVP`
- `PVE`

Unknown-mode quests are not imported.

### What Gets Written

On confirm:

- selected mode quests are marked complete
- `questsWithItems` is cleared for imported quests
- optional prerequisite quests are also marked complete
- `questsWithItems` is cleared for auto-completed prerequisites
- `gameMode` is set to the imported mode

### Prerequisite Backfill

If a quest row has `Auto-complete prerequisites` enabled:

- the import walks the transitive prerequisite chain using `taskRequirements`
- already completed prerequisite quests are ignored in the review list
- only newly auto-completed prerequisite quests appear in the review summary

This logic is currently quest-graph based and does not attempt more advanced faction-aware inference beyond the existing loaded data.

---

## Main Empty / Error States

### Invalid Folder

Shown when the selection does not look like EFT logs.

### No New Files Seen

Shown when relevant files were selected but all relevant files are already in the seen-file cache.

### All Quests Already Completed

Shown when new relevant files were parsed but all resolved importable PVP/PVE quests are already complete.

### No Push-Notification Logs

Shown when the selection looks like logs but no matching `push-notifications*.log` files were found.

---

## Important Files To Update

When changing this feature, these are the main files to check first:

- `src/features/quests/components/QuestLogImportDialog.tsx`
- `src/lib/utils/quest-log-parser.ts`
- `src/lib/utils/quest-log-import.ts`
- `src/features/quests/components/QuestsSyncBar.tsx`

Tests:

- `src/lib/utils/quest-log-parser.test.ts`
- `src/lib/utils/quest-log-import.test.ts`

---

## Known Limitations

- The feature relies on client logs and cannot detect quests that never produced matching notifications.
- File dedupe uses metadata, not full content hashing.
- Unknown-mode quests are view-only and cannot be imported.
- The feature is good for catch-up, but the main sync flow is still better for deeper/manual reconstruction.

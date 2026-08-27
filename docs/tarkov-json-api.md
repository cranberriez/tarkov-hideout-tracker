# Tarkov JSON API Provider

The application loads quest data exclusively from `https://json.tarkov.dev`. Other Tarkov data can still use either the original GraphQL services or the JSON API adapters while that legacy provider switch remains in place. The non-quest provider is selected server-side with `TARKOV_DATA_SOURCE`:

- `json` (default) uses `https://json.tarkov.dev`.
- `graphql` uses `https://api.tarkov.dev/graphql`.

The selection facade is `src/server/services/tarkovData.ts`. Pages and cron routes import data-fetching entry points from this facade. Its quest exports always resolve to `src/server/services/questsJson.ts`, regardless of `TARKOV_DATA_SOURCE`. The original GraphQL quest implementation remains only as legacy code and must not be wired back into runtime quest consumers.

All requests to the Tarkov.dev JSON and GraphQL APIs send the shared user agent `TarkovHideoutTracker/1.0 (+https://tarkovhideout.com)`. Keep this identity on new upstream request paths so Tarkov.dev can attribute traffic to tarkovhideout.com.

## JSON API Shape

The JSON API publishes a base dataset and an English locale dictionary for each translatable endpoint:

```text
/regular/hideout     /regular/hideout_en
/regular/items       /regular/items_en
/regular/tasks       /regular/tasks_en
/regular/traders     /regular/traders_en
/regular/maps        /regular/maps_en
```

PVE uses the equivalent `/pve/*` datasets and KORD uses `/pvp-season/*`. Base records refer to related entities by ID and contain translation keys. The adapters hydrate those references and translate them into the existing application types.

## Compatibility and Caching

JSON and GraphQL providers expose the same `TimedResponse` payloads and use the existing versioned Redis keys. No client component, Zustand field, persisted storage key, or persistence behavior changes when the provider changes.

Every JSON adapter validates both cached and upstream data. Progression Redis keys are separated by `regular`, `pve`, or `pvp-season`:

- Empty or malformed Redis bodies are ignored rather than treated as fresh.
- Missing or empty upstream datasets throw before `redis.mset`.
- A valid stale Redis body is returned when an upstream refresh fails.
- An invalid upstream response never overwrites a valid Redis body.

The JSON client fetches base and `_en` locale payloads together. Concurrent requests for the same URL share one in-flight promise to avoid duplicate downloads of the large item dataset during a cold render.

## Task Progression Fields

The `/regular/tasks` dataset is the primary source for the full quest shape. The
adapter keeps upstream task IDs unchanged and hydrates related trader, map, item,
and prerequisite references into `FullQuest`. `taskRequirements[].task` remains an
ID reference to another task; it is the authoritative edge used by quest
availability, manual sync, completion cascades, and relationship display.
The adapter keeps level-0 tasks: Tarkov 1.1 now uses `minPlayerLevel: 0` for some
normal PMC quest lines, so that value is display/availability data rather than a
safe server-side exclusion signal.
Trader requirements are preserved with their upstream `requirementType`:

- `level` is a trader loyalty-level gate and is displayed/evaluated as LL.
- `reputation` is a standing gate and is displayed separately. It is preserved
  but not evaluated until the user profile has a dedicated reputation value.
- A gate can refer to a trader other than the issuing trader; that cross-trader
  requirement remains part of availability and display.
- Legacy GraphQL fixtures may use `loyaltyLevel`; the shared gate helper treats it
  as the compatibility spelling for `level`.

The JSON adapter also preserves `otherRequirements` as typed raw gates. Known
records can include `id`, `type`, `compareMethod`, and `value`, with type-specific
fields such as `traders` or `variableId`; additional upstream properties are
retained. `globalVariable` and
`dialogue` gates are carried through for future behavior but are not interpreted as
loyalty levels, quest IDs, or series membership today.

## Series Candidates and Curated Organization

Series organization is derived after fetching JSON/GraphQL data. The curated
manifest is `src/lib/data/quest-series.json`; `src/lib/utils/quest-organization.ts`
validates its quest IDs, membership, order values, and issuing-trader ownership,
then applies Series-first precedence before assigning non-series quests to LL1–LL4.
The manifest is keyed by stable quest IDs and is intentionally separate from the
persisted user store.

Use the maintenance command below to review candidates from a downloaded task
snapshot:

```bash
npm run quest-series-candidates -- path/to/tasks.json > quest-series-candidates.json
```

`scripts/generate-quest-series-candidates.mjs` accepts raw task records/arrays,
mapped quest arrays, and serialized fetch-cache `body` wrappers. It writes no
files; it prints deterministic JSON containing numbered-name groups, same-trader
prerequisite components of length two or more, repeated-prefix groups, and review
flags for duplicate names, branches, faction variants, and cross-trader chains.
Candidate detection is maintenance-only. Review the report and commit only a
curated ID manifest; production code must not infer series membership from names.

## Cache and Persistence Compatibility

Changing the normalized `FullQuest` shape requires bumping
`CACHE_VERSIONS.questsFull` in `src/lib/cfg/cacheVersions.ts` so Redis cannot serve
an older payload under the new shape. The current progression data is intentionally
frozen (`PROGRESSION_DATA_FROZEN`) and quest pages use `revalidate = false` during
the Tarkov 1.1 transition; verify a cold fetch before removing that freeze. A
manifest-only organization change does not add persisted fields or change the
provider payload shape.

The JSON migration must not change the Zustand localStorage key
(`tarkov-hideout-user-state`), its version (14), persisted field names, or any
quest-ID maps. Existing completion, failure, hand-in, ignored, and pinned records
must continue to be looked up by the upstream `quest.id`, even when quest names,
categories, or series labels change.

## Switching Non-Quest Providers

Set the server-only environment variable and redeploy:

```text
TARKOV_DATA_SOURCE=json
```

`graphql` affects only the remaining non-quest services. Quest data stays on the JSON API. After changing providers, invoke the authenticated `/api/revalidate` route for the relevant non-quest tags if an immediate refresh is required.

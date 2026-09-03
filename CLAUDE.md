# Claude Code guidance

Follow `AGENTS.md` as the authoritative contributor guide for this repository.
Start with `docs/README.md` and `docs/overview.md` before changing an architecture
or feature area.

The current runtime data path is:

```text
offline Tarkov.dev normalization -> immutable Turso release
                                  -> Turso repository
                                  -> named page/API queries
```

Price history is the only live Tarkov.dev data request. Do not reintroduce the
removed Redis cache, global data context, or `current-repository` adapter.

Never change persistent Zustand keys, field names, versions, or migration behavior
without first reading `docs/state-management.md` and the store implementation.

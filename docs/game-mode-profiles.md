# Game Mode Profiles

The app supports three independent character profiles:

| App label | Tarkov.dev JSON prefix |
| --- | --- |
| PVP | `regular` |
| PVE | `pve` |
| KORD | `pvp-season` |

`useUserStore.gameMode` identifies the active profile. `profiles` stores a complete
`PlayerProfileState` for each mode. The familiar flat progress fields remain the
active profile projection so existing components can use focused selectors. Every
profile-mutating store action writes the active projection and its matching entry
in `profiles` atomically. `setGameMode` loads the selected profile into that
projection.

Profile-scoped state includes hideout progress, inventory, quest progress and
history, trader loyalty and Fence standing, player and prestige level, faction,
quest goals, game edition, edition-bonus status, and setup completion. Display and
filter preferences remain shared between profiles.

The localStorage key remains `tarkov-hideout-user-state`. Version 19 preserves the
entire version-18 payload in `deprecatedLegacyState`, then creates clean PVP, PVE,
and KORD profiles. Legacy data is intentionally not assigned automatically. When
an unhandled snapshot exists, the app opens a conversion dialog that summarizes
the old character progress and asks the user to choose a destination profile.
Confirming copies profile-scoped fields into that profile, switches to it, and sets
`hasConvertedDeprecatedLegacyState`. The original snapshot is retained unchanged.
The dialog can be reopened from Settings; when no snapshot exists, no automatic
dialog is shown. Canceling sets `hasDismissedDeprecatedLegacyState`, which suppresses
future automatic prompts while keeping restoration available from Settings.
Destination profiles with existing progress are marked in the picker. Choosing
one adds a second confirmation screen comparing the old snapshot on the left
with the current destination data on the right before replacement is allowed.

The active mode is mirrored to the `tarkov-active-game-mode` cookie. Server
components use the cookie to select mode-prefixed progression data. Switching in
the character panel updates local state and the cookie, then refreshes the current
route behind a loading overlay.

Progression and price Redis keys include the game-mode suffix. This prevents
records returned by `regular`, `pve`, and `pvp-season` from sharing a cache entry.

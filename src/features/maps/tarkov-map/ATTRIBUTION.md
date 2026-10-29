# Map library sources

Vendored by `scripts/vendor-maps.mjs`; pinned commits are recorded in `calibration.json` under `source`.

- `assets/svg/`: [the-hideout/tarkov-dev-svg-maps](https://github.com/the-hideout/tarkov-dev-svg-maps), licensed [CC BY-NC-SA 4.0](http://creativecommons.org/licenses/by-nc-sa/4.0/). The license is revoked for software that facilitates cheating (radars, ESP overlays, cheat-client maps, automation). Unmodified; only displayed.
- `assets/icons/` and calibration in `calibration.json` (`transform`, `coordinateRotation`, `bounds`, `svgBounds`, `layers`, `labels`): [the-hideout/tarkov-dev](https://github.com/the-hideout/tarkov-dev) (`public/maps/interactive`, `src/data/maps.json`), MIT License, Copyright (c) 2019 Oskar Risberg.
- `games` in `calibration.json`: from the [tarkov.dev API](https://json.tarkov.dev/pve/maps). `nameId` is the `Location:` id and `scenePath` the `scene preset path:` bundle in game logs; the-hideout's [TarkovMonitor](https://github.com/the-hideout/TarkovMonitor/blob/main/TarkovMonitor/GameWatcher.cs) matches logs the same way.
- Raster tiles (`tilePath`): not vendored. Streamed from `https://assets.tarkov.dev/maps/` (generated with [the-hideout/leaflet-tiles](https://github.com/the-hideout/leaflet-tiles)) and cached by the desktop app. Streets, Lighthouse and Terminal have no tiles; Labs, Labyrinth and Icebreaker have only tiles.

`Labs.svg` exists upstream but tarkov.dev has no SVG calibration for it, so it is not vendored. Icebreaker's calibration upstream reuses Factory's bounds and may be a placeholder.

## Battle Pass document photos

Vendored by `scripts/vendor-documents.mjs` from the Tarkov Hideout repo's snapshot of [EFT Docs Map](https://tarkovdoc.com/maps/) (`battle-pass-map-data.json` and its bundled photos), resized to 800px webp.

- `assets/documents/` and the titles, descriptions and keys in `documents/locations.json`: EFT Docs Map. It declares no content license. Game imagery and trademarks © Battlestate Games.
- Positions in `documents/locations.json` are tarkov.dev document spawns (`lootLoose`), matched by fitting each map; `documents/links.json` holds hand-made links.

import hosts from "./hosts.json";

// tarkov.dev hosts. The desktop backend reads the same file at build time (`src-tauri/build.rs`).
/** Map data API root, e.g. `${DATA_HOST}/pve/maps`. */
export const DATA_HOST: string = hosts.data;
/** Image host for item icons (`<id>-512.webp`) and portraits. */
export const ASSET_HOST: string = hosts.assets;
/** Leaflet tile host; calibration tile paths are relative to it. */
export const TILE_HOST: string = hosts.tiles;

import assert from "node:assert/strict";
import test from "node:test";
import {
  createProfitOptionsStore,
  DEFAULT_PROFIT_OPTIONS,
  parseProfitOptions,
  profitOptionsStorageKey,
} from "./profit-options";

test("malformed and non-object payloads restore defaults", () => {
  for (const raw of [null, "{", "null", "[]", "true", '"text"', "42"]) {
    assert.deepEqual(parseProfitOptions(raw), DEFAULT_PROFIT_OPTIONS);
  }
});

test("only known boolean fields survive parsing, including nested filters", () => {
  assert.deepEqual(parseProfitOptions(JSON.stringify({
    availableOnly: false,
    profitableOnly: true,
    useTraderSaleForLockedOutputs: false,
    allowCrafts: "false",
    allowBarters: 0,
    unknown: true,
    lockFilters: { flea: true, quest: "true", vendor: false, station: null },
  })), {
    ...DEFAULT_PROFIT_OPTIONS,
    availableOnly: false,
    profitableOnly: true,
    useTraderSaleForLockedOutputs: false,
    lockFilters: { flea: true, quest: false, vendor: false, station: false },
  });
  for (const lockFilters of [null, [], true, "invalid"]) {
    assert.deepEqual(
      parseProfitOptions(JSON.stringify({ lockFilters })),
      DEFAULT_PROFIT_OPTIONS,
    );
  }
});

test("reads never overwrite saved modes and every option survives page remounts", () => {
  const values = new Map<string, string>();
  let writes = 0;
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      writes += 1;
      values.set(key, value);
    },
  };
  const saved = {
    availableOnly: false,
    profitableOnly: true,
    useTraderSaleForLockedOutputs: false,
    allowCrafts: false,
    allowBarters: false,
    lockFilters: { flea: true, quest: true, vendor: true, station: true },
  };
  values.set(profitOptionsStorageKey("PVE"), JSON.stringify(saved));
  const pvp = createProfitOptionsStore("PVP", () => storage);
  const pve = createProfitOptionsStore("PVE", () => storage);
  const kord = createProfitOptionsStore("KORD", () => storage);
  assert.deepEqual(pvp.getSnapshot(), DEFAULT_PROFIT_OPTIONS);
  assert.deepEqual(pve.getSnapshot(), saved);
  assert.deepEqual(kord.getSnapshot(), DEFAULT_PROFIT_OPTIONS);
  assert.equal(writes, 0);
  assert.equal(pve.getSnapshot(), pve.getSnapshot());

  pvp.setOption("profitableOnly", true);
  pve.setOption("allowCrafts", true);
  kord.setOption("availableOnly", false);
  assert.deepEqual(pvp.getSnapshot(), { ...DEFAULT_PROFIT_OPTIONS, profitableOnly: true });
  assert.deepEqual(pve.getSnapshot(), { ...saved, allowCrafts: true });
  assert.deepEqual(kord.getSnapshot(), { ...DEFAULT_PROFIT_OPTIONS, availableOnly: false });
  const otherPage = createProfitOptionsStore("PVE", () => storage);
  assert.deepEqual(otherPage.getSnapshot(), { ...saved, allowCrafts: true });
  otherPage.setOption("lockFilters", DEFAULT_PROFIT_OPTIONS.lockFilters);
  assert.deepEqual(pve.getSnapshot().lockFilters, DEFAULT_PROFIT_OPTIONS.lockFilters);
  assert.equal(writes, 4);
});

test("storage failures retain edits in memory without affecting another mode", () => {
  const unavailable = () => { throw new Error("Storage unavailable"); };
  const pvp = createProfitOptionsStore("PVP", unavailable);
  const pve = createProfitOptionsStore("PVE", unavailable);
  pvp.setOption("availableOnly", false);
  assert.equal(pvp.getSnapshot().availableOnly, false);
  assert.equal(pve.getSnapshot().availableOnly, true);

  const readOnly = createProfitOptionsStore("KORD", () => ({
    getItem: () => null,
    setItem: unavailable,
  }));
  readOnly.setOption("allowCrafts", false);
  assert.equal(readOnly.getSnapshot().allowCrafts, false);
});

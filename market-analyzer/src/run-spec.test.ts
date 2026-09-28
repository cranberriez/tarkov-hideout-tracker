import test from "node:test";
import assert from "node:assert/strict";
import type { TarkovDataMode } from "../../src/types/common";
import { describeRunRequest, mergeRunRequests, parseRunSpec, specArgument, UsageError } from "./run-spec";

const modes: TarkovDataMode[] = ["pvp-season", "regular", "pve"];

test("parses modes, step lists and shorthands", () => {
	assert.equal(describeRunRequest(parseRunSpec("pvp-season:analyze", modes)), "pvp-season:analyze");
	assert.equal(describeRunRequest(parseRunSpec("pvp-season:poll+push", modes)), "pvp-season:poll+push");
	assert.equal(describeRunRequest(parseRunSpec("regular", modes)), "regular:poll+push+analyze");
	assert.equal(
		describeRunRequest(parseRunSpec("all:reanalyze", modes)),
		"pvp-season:reanalyze, regular:reanalyze, pve:reanalyze",
	);
	assert.equal(
		describeRunRequest(parseRunSpec("all:analyze", modes)),
		"pvp-season:analyze, regular:analyze, pve:analyze",
	);
	assert.equal(describeRunRequest(parseRunSpec(" pve:poll , pve:analyze ", modes)), "pve:poll+analyze");
});

test("rejects unknown modes, disabled modes and steps", () => {
	assert.throws(() => parseRunSpec("kord:analyze", modes), /Unknown or disabled mode "kord"/);
	assert.throws(() => parseRunSpec("pve:analyze", ["pvp-season"]), /worker modes: pvp-season/);
	assert.throws(() => parseRunSpec("pve:analyse", modes), /Unknown step "analyse"/);
	assert.throws(() => parseRunSpec("pve:poll:push", modes), /Invalid run spec/);
	assert.throws(() => parseRunSpec(" , ", modes), /empty/);
});

test("requests merge per mode", () => {
	const target = parseRunSpec("pve:poll", modes);
	mergeRunRequests(target, parseRunSpec("pve:analyze,regular:push", modes));
	assert.equal(describeRunRequest(target), "pve:poll+analyze, regular:push");
});

test("finds the spec argument around --modes", () => {
	assert.equal(specArgument(["pvp-season:analyze"]), "pvp-season:analyze");
	assert.equal(specArgument(["--modes", "pve", "pve:poll"]), "pve:poll");
	assert.equal(specArgument(["pve:poll", "--modes", "pve"]), "pve:poll");
	assert.equal(specArgument(["--modes", "pve"]), null);
	assert.equal(specArgument([]), null);
	assert.throws(() => parseRunSpec("nope", modes), UsageError);
});

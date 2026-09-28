import test from "node:test";
import assert from "node:assert/strict";
import { databaseHint, describeDatabaseTarget, describeError } from "./errors";

test("describes the cause chain hidden by query wrappers", () => {
	const driver = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:5555"), { code: "ECONNREFUSED" });
	const wrapped = new Error('Failed query: select "item_modes"."item_id" from "item_modes"\nparams: pve', {
		cause: driver,
	});
	assert.equal(
		describeError(wrapped),
		'Failed query: select "item_modes"."item_id" from "item_modes" <- caused by: connect ECONNREFUSED 127.0.0.1:5555',
	);
	const coded = Object.assign(new Error("relation does not exist"), { code: "42P01" });
	assert.equal(describeError(coded), "relation does not exist [42P01]");
	assert.equal(describeError("plain"), "plain");
});

test("aggregate connection failures list each attempt", () => {
	const aggregate = Object.assign(
		new AggregateError(
			[new Error("connect ECONNREFUSED ::1:5555"), new Error("connect ECONNREFUSED 127.0.0.1:5555")],
			"",
		),
		{ code: "ECONNREFUSED" },
	);
	assert.equal(
		describeError(new Error("Failed query: select 1", { cause: aggregate })),
		"Failed query: select 1 <- caused by: connect ECONNREFUSED ::1:5555; connect ECONNREFUSED 127.0.0.1:5555",
	);
});

test("cyclic causes terminate", () => {
	const error = new Error("loop");
	(error as { cause?: unknown }).cause = error;
	assert.equal(describeError(error), "loop");
});

test("database target never includes credentials", () => {
	assert.equal(
		describeDatabaseTarget("postgresql://user:secret@db.example:5432/tarkov?sslmode=require"),
		"db.example:5432/tarkov",
	);
	assert.equal(describeDatabaseTarget(undefined), "(DATABASE_URL is not set)");
	assert.equal(describeDatabaseTarget("nonsense"), "(DATABASE_URL is not a valid URL)");
});

test("hints only for localhost inside a container", () => {
	assert.match(databaseHint("postgresql://u:p@localhost:5555/tarkov", true)!, /host\.docker\.internal/);
	assert.equal(databaseHint("postgresql://u:p@localhost:5555/tarkov", false), undefined);
	assert.equal(databaseHint("postgresql://u:p@host.docker.internal:5555/tarkov", true), undefined);
});

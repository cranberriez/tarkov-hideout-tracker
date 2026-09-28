import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { matchesAppliedChecksum, migrationChecksum } from "./migration-checksum.mjs";

const lf = "CREATE TABLE a (id int);\nCREATE TABLE b (id int);\n";
const crlf = lf.replace(/\n/g, "\r\n");
const raw = (value) => createHash("sha256").update(value).digest("hex");

test("new checksums ignore the checkout's line endings", () => {
	assert.equal(migrationChecksum(crlf), migrationChecksum(lf));
	assert.equal(migrationChecksum(lf), raw(lf));
});

test("applied checksums from LF or CRLF checkouts both match", () => {
	for (const source of [lf, crlf]) {
		assert.equal(matchesAppliedChecksum(source, raw(lf)), true);
		assert.equal(matchesAppliedChecksum(source, raw(crlf)), true);
	}
	assert.equal(matchesAppliedChecksum(lf.replace("b", "c"), raw(lf)), false);
});

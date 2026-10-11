import assert from "node:assert/strict";
import test from "node:test";
import {
	SUBMITTED_COOKIE,
	RESHOW_COOKIE,
	RETRY_DELAY_MS,
	canShowRating,
	isRating,
	ratingCookieValues,
	safezoneLayout,
} from "./rating-model";

test("rating cookies are global and successful submissions stay suppressed", () => {
	assert.equal(canShowRating(""), true);
	assert.equal(canShowRating(`${SUBMITTED_COOKIE}=true; unrelated=kept`, 10), false);
	assert.equal(canShowRating(`${SUBMITTED_COOKIE}=true; ${RESHOW_COOKIE}=1`, 100), false);
});

test("failures reappear at the 48-hour boundary, while malformed dates cannot suppress forever", () => {
	const now = 1000;
	const values = ratingCookieValues(false, now);
	const header = `${SUBMITTED_COOKIE}=${values.submitted}; ${RESHOW_COOKIE}=${values.reshowAt}`;
	assert.equal(Number(values.reshowAt), now + RETRY_DELAY_MS);
	assert.equal(canShowRating(header, now + RETRY_DELAY_MS - 1), false);
	assert.equal(canShowRating(header, now + RETRY_DELAY_MS), true);
	assert.equal(canShowRating(`${RESHOW_COOKIE}=NaN`), true);
	assert.equal(canShowRating(`${RESHOW_COOKIE}=Infinity`), true);
	assert.equal(canShowRating(`${RESHOW_COOKIE}=-1`), true);
	assert.deepEqual(ratingCookieValues(true, now), { submitted: "true", reshowAt: "0" });
});

test("safezone breakpoints preserve enough room for the pill plus edge spacing", () => {
	assert.equal(safezoneLayout(128), "horizontal");
	assert.equal(safezoneLayout(127), "vertical");
	assert.equal(safezoneLayout(72), "vertical");
	assert.equal(safezoneLayout(71), "collapsed");
	assert.equal(safezoneLayout(0), "collapsed");
});

test("anonymous ratings accept only the two supported values", () => {
	for (const value of ["good", "bad"]) assert.equal(isRating(value), true);
	for (const value of ["", "GOOD", null, {}, 1, ["good"]]) assert.equal(isRating(value), false);
});

import assert from "node:assert/strict";
import test from "node:test";
import { RETRY_DELAY_MS } from "../../features/site-rating/rating-model";
import { runRatingSubmission } from "./submission";

test("success is saved only after the recorder finishes", async () => {
	let release!: () => void;
	let completed = false;
	const pending = runRatingSubmission(
		"good",
		async (rating) => {
			assert.equal(rating, "good");
			await new Promise<void>((resolve) => {
				release = resolve;
			});
		},
		() => 100,
	);
	void pending.then(() => {
		completed = true;
	});
	await Promise.resolve();
	assert.equal(completed, false);
	release();
	assert.deepEqual(await pending, { success: true, cookieValues: { submitted: "true", reshowAt: "0" } });
});

test("recorder failure saves a retry from completion time for either vote", async (t) => {
	t.mock.method(console, "error", () => {});
	for (const rating of ["good", "bad"] as const) {
		const result = await runRatingSubmission(
			rating,
			async () => {
				throw new Error("offline");
			},
			() => 500,
		);
		assert.deepEqual(result, {
			success: false,
			cookieValues: { submitted: "false", reshowAt: String(500 + RETRY_DELAY_MS) },
		});
	}
});

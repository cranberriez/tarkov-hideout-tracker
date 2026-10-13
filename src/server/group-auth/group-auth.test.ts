import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { accessAllowed, corsHeaders, createRateLimiter, readGroupAuthConfig, signGroupChannel } from "./group-auth";

const config = { appKey: "key", secret: "secret", cluster: "eu", accessKey: null };
const valid = { socketId: "123.456", channelName: "presence-group-ABC234", userId: "a1b2c3d4e5f6g7h8", name: "PMC_42" };

test("signs presence channels with the user's channel data", () => {
	const signed = signGroupChannel(config, valid);
	assert.ok(signed.ok);
	assert.equal(signed.channel_data, JSON.stringify({ user_id: valid.userId, user_info: { name: "PMC_42" } }));
	const expected = createHmac("sha256", "secret")
		.update(`123.456:presence-group-ABC234:${signed.channel_data}`)
		.digest("hex");
	assert.equal(signed.auth, `key:${expected}`);
});

test("refuses anything but group channels and valid identities", () => {
	for (const channelName of [
		"presence-group-abc234",
		"presence-group-ABC23",
		"private-group-ABC234",
		"presence-group-ABC0O1",
		"presence-other",
	]) {
		assert.equal(signGroupChannel(config, { ...valid, channelName }).ok, false, channelName);
	}
	for (const name of ["", "sixteen_chars_xx", "has space", "émile", null]) {
		assert.equal(signGroupChannel(config, { ...valid, name }).ok, false, String(name));
	}
	assert.equal(signGroupChannel(config, { ...valid, userId: "short" }).ok, false);
	assert.equal(signGroupChannel(config, { ...valid, socketId: 5 }).ok, false);
});

test("the access key is only required when configured", () => {
	assert.equal(accessAllowed(config, null), true);
	const locked = { ...config, accessKey: "letmein" };
	assert.equal(accessAllowed(locked, null), false);
	assert.equal(accessAllowed(locked, "letmeim"), false);
	assert.equal(accessAllowed(locked, "letmein"), true);
});

test("config needs key, secret and cluster; a blank access key means open", () => {
	assert.equal(readGroupAuthConfig({ APINATOR_KEY: "k", APINATOR_SECRET: "s" }), null);
	assert.deepEqual(
		readGroupAuthConfig({
			APINATOR_KEY: "k",
			APINATOR_SECRET: "s",
			APINATOR_CLUSTER: "eu",
			APINATOR_GROUP_ACCESS_KEY: " ",
		}),
		{ appKey: "k", secret: "s", cluster: "eu", accessKey: null },
	);
});

test("rate limiter allows `limit` per window per client", () => {
	const allow = createRateLimiter(2, 1000);
	assert.equal(allow("a", 0), true);
	assert.equal(allow("a", 10), true);
	assert.equal(allow("a", 20), false);
	assert.equal(allow("b", 20), true);
	assert.equal(allow("a", 1000), true);
});

test("CORS only for the app's webview origins", () => {
	assert.equal(corsHeaders("http://tauri.localhost")["Access-Control-Allow-Origin"], "http://tauri.localhost");
	assert.equal(corsHeaders("http://127.0.0.1:1422")["Access-Control-Allow-Origin"], "http://127.0.0.1:1422");
	assert.deepEqual(corsHeaders("http://127.0.0.1:1430"), {});
	assert.deepEqual(corsHeaders("http://localhost:3000"), {});
	assert.deepEqual(corsHeaders("https://evil.example"), {});
	assert.deepEqual(corsHeaders(null), {});
});

import { createHash } from "node:crypto";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

/** Checksum recorded for new migrations: independent of the checkout's line endings. */
export function migrationChecksum(source) {
	return sha256(source.replace(/\r\n/g, "\n"));
}

/**
 * Whether an applied migration is unchanged. Earlier runs hashed raw file bytes, so a
 * stored checksum may come from an LF or a CRLF checkout (core.autocrlf on Windows).
 */
export function matchesAppliedChecksum(source, stored) {
	const lf = source.replace(/\r\n/g, "\n");
	return stored === sha256(lf) || stored === sha256(lf.replace(/\n/g, "\r\n"));
}

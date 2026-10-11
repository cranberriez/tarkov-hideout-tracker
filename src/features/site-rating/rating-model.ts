export type SiteRatingValue = "good" | "bad";
/** Enables site-wide success suppression and the 48-hour failure retry cookies. */
export const RATING_PERSISTENCE_ENABLED = true;
export const SUBMITTED_COOKIE = "tarkov-feedback-submitted";
export const RESHOW_COOKIE = "tarkov-feedback-reshow-at";
export const RETRY_DELAY_MS = 48 * 60 * 60 * 1000;
export const COOKIE_MAX_AGE = 400 * 24 * 60 * 60;

export function isRating(value: unknown): value is SiteRatingValue {
	return value === "good" || value === "bad";
}

export function readRatingCookies(header: string) {
	const values = new Map(
		header.split(";").map((part) => {
			const [key, ...value] = part.trim().split("=");
			return [key, value.join("=")];
		}),
	);
	const timestamp = Number(values.get(RESHOW_COOKIE));
	return {
		submitted: values.get(SUBMITTED_COOKIE) === "true",
		reshowAt: Number.isFinite(timestamp) && timestamp > 0 ? timestamp : 0,
	};
}

export function canShowRating(header: string, now = Date.now()) {
	const { submitted, reshowAt } = readRatingCookies(header);
	return !submitted && reshowAt <= now;
}

export function ratingCookieValues(success: boolean, now = Date.now()) {
	return { submitted: String(success), reshowAt: success ? "0" : String(now + RETRY_DELAY_MS) };
}

export function safezoneLayout(width: number) {
	return width >= 128 ? "horizontal" : width >= 72 ? "vertical" : "collapsed";
}

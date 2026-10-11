import { ratingCookieValues, type SiteRatingValue } from "../../features/site-rating/rating-model";

/** A successful response means storage finished, not merely that a request started. */
export async function runRatingSubmission(
	rating: SiteRatingValue,
	record: (rating: SiteRatingValue) => Promise<void>,
	now = Date.now,
) {
	let success = false;
	try {
		await record(rating);
		success = true;
	} catch {
		console.error("Site rating could not be recorded");
	}
	return { success, cookieValues: ratingCookieValues(success, now()) };
}

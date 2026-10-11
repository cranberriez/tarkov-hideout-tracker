"use server";

import { cookies } from "next/headers";
import {
	COOKIE_MAX_AGE,
	RATING_PERSISTENCE_ENABLED,
	SUBMITTED_COOKIE,
	RESHOW_COOKIE,
	canShowRating,
	isRating,
} from "./rating-model";
import { recordSiteRating } from "@/server/site-rating/record-site-rating";
import { runRatingSubmission } from "@/server/site-rating/submission";

export async function submitSiteRating(value: unknown): Promise<{ success: boolean }> {
	if (!isRating(value)) return { success: false };
	if (!RATING_PERSISTENCE_ENABLED) {
		const { success } = await runRatingSubmission(value, recordSiteRating);
		return { success };
	}
	const cookieStore = await cookies();
	if (!canShowRating(cookieStore.toString())) {
		return { success: cookieStore.get(SUBMITTED_COOKIE)?.value === "true" };
	}
	const { success, cookieValues: values } = await runRatingSubmission(value, recordSiteRating);
	const options = {
		path: "/",
		sameSite: "lax" as const,
		secure: process.env.NODE_ENV === "production",
		maxAge: COOKIE_MAX_AGE,
	};
	cookieStore.set(SUBMITTED_COOKIE, values.submitted, options);
	cookieStore.set(RESHOW_COOKIE, values.reshowAt, options);
	return { success };
}

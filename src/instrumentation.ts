import type { Instrumentation } from "next";

/**
 * One structured line per server error so Vercel logs show the route and the digest that error pages display.
 * Request headers are left out on purpose (cookies, IPs).
 */
export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
	const err = error instanceof Error ? error : new Error(String(error));
	const digest = typeof error === "object" && error !== null && "digest" in error ? String(error.digest) : undefined;
	console.error(
		"[server-error]",
		JSON.stringify({
			digest,
			message: err.message,
			method: request.method,
			path: request.path,
			routePath: context.routePath,
			routeType: context.routeType,
			renderSource: context.renderSource,
			revalidateReason: context.revalidateReason,
		}),
		err.stack,
	);
};

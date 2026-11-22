"use client";

import { RouteErrorRecovery } from "@/components/core/RouteErrorRecovery";

interface RouteErrorProps {
	error: Error & { digest?: string };
	retry: () => void;
}

/** Fallback for pages outside `(data)` (Battle Pass, seasons, news), which has its own boundary. */
export default function RouteError({ error, retry }: RouteErrorProps) {
	return (
		<RouteErrorRecovery
			error={error}
			retry={retry}
			logLabel="Page failed to render"
			title="Something went wrong on this page"
			message="Your saved progress is safe. Try again, and if it keeps happening, report it on GitHub."
		/>
	);
}

"use client";

import { RouteErrorRecovery } from "@/components/core/RouteErrorRecovery";

interface DataRouteErrorProps {
	error: Error & { digest?: string };
	retry: () => void;
}

export default function DataRouteError({ error, retry }: DataRouteErrorProps) {
	return (
		<RouteErrorRecovery
			error={error}
			retry={retry}
			logLabel="Data page failed to render"
			title="This data could not be loaded"
			message="Your saved progress is safe. The external Tarkov data service may be temporarily unavailable or missing data for your active profile."
		/>
	);
}

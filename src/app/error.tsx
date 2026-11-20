"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface RouteErrorProps {
	error: Error & { digest?: string };
	reset: () => void;
}

/** Fallback for pages outside `(data)` (Battle Pass, seasons, news), which has its own boundary. */
export default function RouteError({ error, reset }: RouteErrorProps) {
	useEffect(() => {
		console.error("Page failed to render", error);
	}, [error]);

	return (
		<main className="container mx-auto px-6 py-16">
			<div
				role="alert"
				className="mx-auto max-w-2xl rounded border border-danger/30 bg-danger-surface/30 px-6 py-8 text-center text-danger"
			>
				<AlertTriangle aria-hidden="true" className="mx-auto size-8 text-danger" />
				<h1 className="mt-4 text-2xl font-bold">Something went wrong on this page</h1>
				<p className="mt-2 text-sm text-danger/75">
					Your saved progress is safe. Try again, and if it keeps happening, report it on GitHub.
				</p>
				<button
					type="button"
					onClick={reset}
					className="mt-5 inline-flex items-center gap-2 rounded border border-danger/30 bg-danger/10 px-4 py-2 text-sm font-semibold text-danger transition-colors hover:bg-danger/20"
				>
					<RefreshCw aria-hidden="true" className="size-4" />
					Try again
				</button>
			</div>
		</main>
	);
}

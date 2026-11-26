"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { RouteLoader } from "./RouteLoader";

/** How long a failed attempt blocks another automatic one for the same page, so a hard failure cannot loop. */
const AUTO_RECOVERY_WINDOW_MS = 30_000;
/** A retry that neither recovers nor throws again within this time falls back to the error message. */
const RETRY_TIMEOUT_MS = 10_000;

const CHUNK_ERROR =
	/ChunkLoadError|Loading (CSS )?chunk|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;

/** Stale-deployment asset errors: the open tab references build files that a newer deploy removed. */
function isChunkLoadError(error: Error) {
	return error.name === "ChunkLoadError" || CHUNK_ERROR.test(error.message);
}

/** Records an automatic attempt for `key` and reports whether one is allowed (none in the recent window). */
function claimAutoRecovery(key: string) {
	try {
		const storageKey = `route-error-recovery:${key}`;
		const last = Number(sessionStorage.getItem(storageKey));
		if (last && Date.now() - last < AUTO_RECOVERY_WINDOW_MS) return false;
		sessionStorage.setItem(storageKey, String(Date.now()));
		return true;
	} catch {
		// Without storage we cannot guard against loops, so leave recovery to the user.
		return false;
	}
}

function loaderPage(pathname: string) {
	if (/\/quests(\/|$)/.test(pathname)) return "quests";
	if (/\/items(\/|$)/.test(pathname)) return "items";
	return "hideout";
}

interface RouteErrorRecoveryProps {
	error: Error & { digest?: string };
	retry: () => void;
	logLabel: string;
	title: string;
	message: string;
}

/**
 * Error boundary body that first recovers quietly behind the route loader: a stale-deployment asset error
 * reloads the page once, anything else is retried once. The error message appears only if that fails.
 */
export function RouteErrorRecovery({ error, retry, logLabel, title, message }: RouteErrorRecoveryProps) {
	const pathname = usePathname();
	const [retrying, setRetrying] = useState(true);
	const attemptedError = useRef<Error | null>(null);

	useEffect(() => {
		// The timeout ends an attempt that neither recovers nor fails; 0 shows the message right away.
		let showMessageAfter = RETRY_TIMEOUT_MS;
		const attempted = attemptedError.current;
		if (attempted !== error) {
			console.error(logLabel, error);
			if (attempted) {
				// A different error after our attempt means the attempt failed.
				attemptedError.current = null;
				showMessageAfter = 0;
			} else if (!claimAutoRecovery(pathname)) {
				showMessageAfter = 0;
			} else {
				attemptedError.current = error;
				if (isChunkLoadError(error)) window.location.reload();
				else retry();
			}
		}
		// Also re-armed when the effect re-runs for the same attempt (Strict Mode, new `retry` identity).
		const timeout = setTimeout(() => setRetrying(false), showMessageAfter);
		return () => clearTimeout(timeout);
	}, [error, logLabel, pathname, retry]);

	if (retrying) return <RouteLoader page={loaderPage(pathname)} title="Reconnecting" />;

	return (
		<main className="container mx-auto px-6 py-16">
			<div
				role="alert"
				className="mx-auto max-w-2xl rounded border border-danger/30 bg-danger-surface/30 px-6 py-8 text-center text-danger"
			>
				<AlertTriangle aria-hidden="true" className="mx-auto size-8 text-danger" />
				<h1 className="mt-4 text-2xl font-bold">{title}</h1>
				<p className="mt-2 text-sm text-danger/75">{message}</p>
				<button
					type="button"
					onClick={() => {
						attemptedError.current = error;
						setRetrying(true);
						setTimeout(() => setRetrying(false), RETRY_TIMEOUT_MS);
						if (isChunkLoadError(error)) window.location.reload();
						else retry();
					}}
					className="mt-5 inline-flex items-center gap-2 rounded border border-danger/30 bg-danger/10 px-4 py-2 text-sm font-semibold text-danger transition-colors hover:bg-danger/20"
				>
					<RefreshCw aria-hidden="true" className="size-4" />
					Try again
				</button>
				{error.digest && <p className="mt-4 font-mono text-xs text-danger/60">Error reference: {error.digest}</p>}
			</div>
		</main>
	);
}

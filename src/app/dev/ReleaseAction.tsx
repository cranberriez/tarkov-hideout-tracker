"use client";

import { useActionState, useEffect, useRef } from "react";
import { changeRelease } from "./actions";

export function ReleaseAction({
	mode,
	action,
	releaseId,
	children,
	disabled = false,
}: {
	mode: string;
	action: "pin" | "local" | "resume" | "clear-local";
	releaseId?: string;
	children: React.ReactNode;
	disabled?: boolean;
}) {
	const [state, formAction, pending] = useActionState(changeRelease, { error: null });
	const wasPending = useRef(false);
	useEffect(() => {
		// Discard client item-detail caches and prefetched pages after a scope change.
		if (wasPending.current && !pending && !state.error) window.location.reload();
		wasPending.current = pending;
	}, [pending, state.error]);
	return (
		<form action={formAction} className="space-y-2">
			<input type="hidden" name="mode" value={mode} />
			<input type="hidden" name="action" value={action} />
			{releaseId && <input type="hidden" name="releaseId" value={releaseId} />}
			<button
				disabled={disabled || pending}
				className="rounded-md border border-border px-3 py-2 text-xs font-medium transition hover:border-tarkov-green hover:bg-tarkov-green/10 disabled:cursor-not-allowed disabled:opacity-40"
			>
				{pending ? "Applying…" : children}
			</button>
			{state.error && (
				<p role="alert" className="max-w-sm text-xs text-red-300">
					{state.error}
				</p>
			)}
		</form>
	);
}

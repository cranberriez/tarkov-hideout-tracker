"use client";

import { Component, Suspense, type ReactNode } from "react";
import { QueryErrorResetBoundary, useSuspenseQuery } from "@tanstack/react-query";
import { DataLoadError, DataQueryRetryProvider } from "@/components/core/DataLoadError";
import { RouteLoader } from "@/components/core/RouteLoader";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { useGameDataEnabled } from "@/lib/query/game-data";
import { higherLowerQueryOptions } from "@/lib/query/page-data";
import { HigherLowerGame } from "./HigherLowerGame";

const loader = <RouteLoader page="hideout" title="Higher or Lower" />;

function ErrorPanel({ message }: { message: string }) {
	return (
		<main className="container mx-auto px-6 py-8">
			<DataLoadError title="Higher or Lower is unavailable" messages={[message]} />
		</main>
	);
}

class GameErrorBoundary extends Component<{ onReset: () => void; children: ReactNode }, { error: Error | null }> {
	state = { error: null as Error | null };

	static getDerivedStateFromError(error: Error) {
		return { error };
	}

	retry = () => {
		this.props.onReset();
		this.setState({ error: null });
	};

	render() {
		if (!this.state.error) return this.props.children;
		return (
			<DataQueryRetryProvider retry={this.retry}>
				<ErrorPanel message={this.state.error.message} />
			</DataQueryRetryProvider>
		);
	}
}

function HigherLowerData({ mode }: { mode: TarkovJsonGameMode }) {
	const { data } = useSuspenseQuery(higherLowerQueryOptions(mode));
	if (data.error) return <ErrorPanel message={data.error} />;
	return <HigherLowerGame items={data.items} />;
}

/** Waits for the saved profile's mode, then suspends on the item value payload; a mode change starts a new run. */
export function HigherLowerQueryPage({ mode }: { mode: TarkovJsonGameMode }) {
	const enabled = useGameDataEnabled(mode);
	if (!enabled) return loader;
	return (
		<QueryErrorResetBoundary>
			{({ reset }) => (
				<GameErrorBoundary key={mode} onReset={reset}>
					<Suspense fallback={loader}>
						<HigherLowerData mode={mode} />
					</Suspense>
				</GameErrorBoundary>
			)}
		</QueryErrorResetBoundary>
	);
}

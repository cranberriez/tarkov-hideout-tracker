"use client";

import { Component, Suspense, type ReactNode } from "react";
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { DataLoadError, DataQueryRetryProvider } from "@/components/core/DataLoadError";
import { RouteLoader } from "@/components/core/RouteLoader";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { useGameDataEnabled } from "@/lib/query/game-data";
import { MarketAnalysisPage } from "./MarketAnalysisPage";

const loader = <RouteLoader page="items" title="Market" />;

class MarketErrorBoundary extends Component<{ onReset: () => void; children: ReactNode }, { error: Error | null }> {
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
				<main className="container mx-auto px-6 py-8">
					<DataLoadError title="Market data is unavailable" messages={[this.state.error.message]} />
				</main>
			</DataQueryRetryProvider>
		);
	}
}

/** Waits for the saved profile's mode, then suspends on the single market payload. */
export function MarketQueryPage({ mode }: { mode: TarkovJsonGameMode }) {
	const enabled = useGameDataEnabled(mode);
	if (!enabled) return loader;
	return (
		<QueryErrorResetBoundary>
			{({ reset }) => (
				<MarketErrorBoundary key={mode} onReset={reset}>
					<Suspense fallback={loader}>
						<MarketAnalysisPage mode={mode} />
					</Suspense>
				</MarketErrorBoundary>
			)}
		</QueryErrorResetBoundary>
	);
}

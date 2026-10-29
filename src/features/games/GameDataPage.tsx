"use client";

import { Component, Suspense, type ReactNode } from "react";
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { DataLoadError, DataQueryRetryProvider } from "@/components/core/DataLoadError";
import { RouteLoader } from "@/components/core/RouteLoader";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { useGameDataEnabled } from "@/lib/query/game-data";

export function GameLoader({ title }: { title: string }) {
	return <RouteLoader page="hideout" title={title} />;
}

export function GameDataError({ title, message }: { title: string; message: string }) {
	return (
		<main className="container mx-auto px-6 py-8">
			<DataLoadError title={`${title} is unavailable`} messages={[message]} />
		</main>
	);
}

class GameErrorBoundary extends Component<
	{ title: string; onReset: () => void; children: ReactNode },
	{ error: Error | null }
> {
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
				<GameDataError title={this.props.title} message={this.state.error.message} />
			</DataQueryRetryProvider>
		);
	}
}

/** Waits for the saved profile's mode, then suspends on the game's data; a mode change starts a new run. */
export function GameDataPage({ mode, title, children }: { mode: TarkovJsonGameMode; title: string; children: ReactNode }) {
	const enabled = useGameDataEnabled(mode);
	const loader = <GameLoader title={title} />;
	if (!enabled) return loader;
	return (
		<QueryErrorResetBoundary>
			{({ reset }) => (
				<GameErrorBoundary key={mode} title={title} onReset={reset}>
					<Suspense fallback={loader}>{children}</Suspense>
				</GameErrorBoundary>
			)}
		</QueryErrorResetBoundary>
	);
}

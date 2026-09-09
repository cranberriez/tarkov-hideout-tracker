"use client";

import { useState, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient } from "./client";
import { GameDataScopeLifecycle } from "./game-data";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

export function QueryProvider({ children }: { children: ReactNode }) {
	const [client] = useState(createQueryClient);
	return (
		<QueryClientProvider client={client}>
			<GameDataScopeLifecycle />
			{children}
			<ReactQueryDevtools />
		</QueryClientProvider>
	);
}

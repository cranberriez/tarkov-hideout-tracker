"use client";

import "./globals.css";
import { APP_THEME_BOOT_SCRIPT } from "@/lib/cfg/app-preferences";
import { RouteErrorRecovery } from "@/components/core/RouteErrorRecovery";

interface GlobalErrorProps {
	error: Error & { digest?: string };
	retry: () => void;
}

/** Replaces the root layout when it fails, so it brings its own document, styles and theme. */
export default function GlobalError({ error, retry }: GlobalErrorProps) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<title>Something went wrong · Tarkov Hideout Tracker</title>
				<script dangerouslySetInnerHTML={{ __html: APP_THEME_BOOT_SCRIPT }} />
			</head>
			<body className="antialiased flex min-h-dvh flex-col">
				<RouteErrorRecovery
					error={error}
					retry={retry}
					logLabel="App failed to render"
					title="Something went wrong"
					message="Your saved progress is safe. Try again, and if it keeps happening, report it on GitHub."
				/>
			</body>
		</html>
	);
}

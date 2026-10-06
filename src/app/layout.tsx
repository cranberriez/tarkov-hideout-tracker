import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { isIndexableHost, SITE_URL } from "@/lib/seo";
import "./globals.css";
import { Navbar } from "@/components/core/Navbar";
import { SetupModal } from "../features/setup/SetupModal";
import { Analytics } from "@vercel/analytics/next";
import { SeasonUpdateBanner } from "@/components/core/SeasonUpdateBanner";
import { ActiveGameModeSync } from "@/components/core/ActiveGameModeSync";
import { QuickAddModal } from "@/features/quick-add/QuickAddModal";
import { GlobalItemDetailModal } from "@/features/items/item-detail/GlobalItemDetailModal";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { HoverPreviewProvider } from "@/components/ui/hover-preview-provider";
import { AppThemeSync } from "@/components/core/AppThemeSync";
import { APP_THEME_BOOT_SCRIPT } from "@/lib/cfg/app-preferences";

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
};

export async function generateMetadata(): Promise<Metadata> {
	const index = isIndexableHost((await headers()).get("host"));
	return {
		metadataBase: new URL(SITE_URL),
		title: { default: "Tarkov Hideout Tracker", template: "%s · Tarkov Hideout Tracker" },
		description: "Track Escape from Tarkov hideout upgrades, quests, required items, and progress for PVP, PVE, and KORD.",
		robots: { index, follow: true },
	};
}

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		// The boot script sets data-theme before hydration.
		<html lang="en" suppressHydrationWarning>
			<head>
				<script dangerouslySetInnerHTML={{ __html: APP_THEME_BOOT_SCRIPT }} />
			</head>
			<body className="antialiased flex min-h-dvh flex-col">
				<QueryProvider>
					<HoverPreviewProvider>
						<ActiveGameModeSync />
						<AppThemeSync />
						<Navbar />
						{/* <SeasonUpdateBanner /> */}
						<div className="flex min-h-0 flex-1 flex-col">{children}</div>
						<SetupModal />
						<QuickAddModal />
						<GlobalItemDetailModal />
						<Analytics />
					</HoverPreviewProvider>
				</QueryProvider>
			</body>
		</html>
	);
}

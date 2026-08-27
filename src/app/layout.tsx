import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Navbar } from "@/components/core/Navbar";
import { RouteAwareFooter } from "@/components/core/RouteAwareFooter";
import { SetupModal } from "../features/setup/SetupModal";
import { Analytics } from "@vercel/analytics/next";
import { SeasonUpdateBanner } from "@/components/core/SeasonUpdateBanner";

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
};

export const metadata: Metadata = {
    title: "Tarkov Hideout Tracker",
    description: "Track your Escape from Tarkov hideout progress",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className="antialiased flex min-h-dvh flex-col">
                <Navbar />
                {/* <SeasonUpdateBanner /> */}
                <div className="flex min-h-0 flex-1 flex-col">{children}</div>
                <RouteAwareFooter />
                <SetupModal />
                <Analytics />
            </body>
        </html>
    );
}

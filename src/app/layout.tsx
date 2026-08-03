import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Navbar } from "@/components/core/Navbar";
import { Footer } from "@/components/core/Footer";
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
            <body className="antialiased min-h-screen flex flex-col">
                <Navbar />
                <SeasonUpdateBanner />
                <div className="flex-1">{children}</div>
                <Footer />
                <SetupModal />
                <Analytics />
            </body>
        </html>
    );
}

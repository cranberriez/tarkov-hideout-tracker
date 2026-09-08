import type { TarkovJsonGameMode } from "@/lib/game-mode";

export function devReleaseCookie(mode: TarkovJsonGameMode) {
	return `tarkov-dev-release-${mode}`;
}

export async function getDevReleaseOverride(mode: TarkovJsonGameMode): Promise<string | null> {
	if (process.env.NODE_ENV !== "development") return null;
	const { cookies } = await import("next/headers");
	try {
		return (await cookies()).get(devReleaseCookie(mode))?.value || null;
	} catch (error) {
		// Offline tools can inherit NODE_ENV=development, but have no request cookies.
		if (error instanceof Error && error.message.includes("outside a request scope")) return null;
		throw error;
	}
}

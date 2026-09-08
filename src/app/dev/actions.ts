"use server";

import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { getTursoClient } from "@/server/db/client";
import { devReleaseCookie } from "@/server/db/dev-release-override";
import { validateReleaseOverride } from "@/server/db/release-config";
import { activateRelease, resumeReleaseUpdates } from "@/server/db/release-selection.mjs";

export async function changeRelease(_previous: { error: string | null }, form: FormData): Promise<{ error: string | null }> {
	if (process.env.NODE_ENV !== "development") notFound();
	try {
		const mode = String(form.get("mode")) as TarkovJsonGameMode;
		if (!["regular", "pve", "pvp-season"].includes(mode)) throw new Error("Unsupported game mode");
		const action = String(form.get("action"));
		if (action === "clear-local") {
			(await cookies()).delete(devReleaseCookie(mode));
		} else {
			const db = getTursoClient();
			if (action === "resume") {
				await resumeReleaseUpdates(db, mode);
			} else if (action === "pin" || action === "local") {
				const releaseId = String(form.get("releaseId") ?? "");
				if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(releaseId)) throw new Error("Invalid release ID");
				await validateReleaseOverride(mode, releaseId, db);
				if (action === "pin") await activateRelease(db, releaseId, [mode], {}, { pin: true });
				else (await cookies()).set(devReleaseCookie(mode), releaseId, { httpOnly: true, sameSite: "strict", path: "/", maxAge: 60 * 60 * 24 * 30 });
			} else throw new Error("Unsupported release action");
		}
		revalidatePath("/dev");
		return { error: null };
	} catch (error) {
		return { error: error instanceof Error ? error.message : String(error) };
	}
}

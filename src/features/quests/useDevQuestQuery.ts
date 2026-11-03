"use client";

import { useSearchParams } from "next/navigation";
import { isDev } from "@/lib/is-dev";
import { DEV_QUEST_QUERY } from "./dev-quest-fixture";

/**
 * The development-only `?q=dev-test` fixture switch. Production builds never call
 * `useSearchParams` here, so quest routes keep their prerendered content.
 */
export const useDevQuestQuery: () => string | null = isDev
	? function useDevQuestQuery() {
			return useSearchParams().get("q") === DEV_QUEST_QUERY ? DEV_QUEST_QUERY : null;
		}
	: () => null;

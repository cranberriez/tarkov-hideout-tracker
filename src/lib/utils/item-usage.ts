import type { ItemUsagePayload } from "@/types";

export function isCompleteItemUsagePayload(payload: ItemUsagePayload): boolean {
    return !payload.bartersError && !payload.craftsError && !payload.presentationError;
}

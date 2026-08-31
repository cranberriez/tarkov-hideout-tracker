import { useCallback, useState } from "react";

export function useQuestGroupCollapse() {
    const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(() => new Set());
    const toggleGroup = useCallback((groupId: string) => {
        setCollapsedGroupIds((current) => {
            const next = new Set(current);
            if (next.has(groupId)) next.delete(groupId);
            else next.add(groupId);
            return next;
        });
    }, []);

    return { collapsedGroupIds, toggleGroup };
}

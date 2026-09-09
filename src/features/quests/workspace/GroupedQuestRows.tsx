import { ChevronDown, ChevronRight } from "lucide-react";
import type { QuestListEntry, QuestListModel } from "./quest-list-model";
import { QuestGroupHeader } from "./QuestGroupHeader";
import { QuestListItem } from "./QuestListItem";

export function GroupedQuestRows({ model, collapsedGroupIds, onToggleGroup, selectedQuestId, highlightedQuestId, onSelectQuest }: {
    model: QuestListModel;
    collapsedGroupIds: ReadonlySet<string>;
    onToggleGroup: (groupId: string) => void;
    selectedQuestId: string | null;
    highlightedQuestId: string | null;
    onSelectQuest: (questId: string) => void;
}) {
    const renderEntries = (entries: QuestListEntry[]): React.ReactNode => entries.map((entry) => {
        if (entry.kind === "quest") {
            return <QuestListItem key={entry.questId} questId={entry.questId} selected={selectedQuestId === entry.questId} highlighted={highlightedQuestId === entry.questId} onSelect={() => onSelectQuest(entry.questId)} />;
        }
        if (entry.kind === "group") {
            const collapsed = collapsedGroupIds.has(entry.id);
            return (
                <section key={entry.id}>
                    <QuestGroupHeader label={entry.label} count={entry.count} collapsed={collapsed} image={entry.image} nested={entry.nested} onClick={() => onToggleGroup(entry.id)} />
                    {!collapsed && renderEntries(entry.entries)}
                </section>
            );
        }
        if (entry.kind === "essential-category") {
            return (
                <section key={entry.id}>
                    <div className="flex h-7 items-center border-b border-highlight/8 bg-[var(--card-bg)] px-3 pl-7 text-[9px] font-semibold uppercase tracking-[0.16em] text-subtle-foreground">
                        <span className="min-w-0 flex-1 truncate">Essential</span>
                        <span className="font-mono font-normal tracking-normal text-subtle-foreground">{entry.count}</span>
                    </div>
                    {renderEntries(entry.entries)}
                </section>
            );
        }
        const condensed = collapsedGroupIds.has(entry.id);
        const questIds = condensed ? entry.activeQuestIds : entry.questIds;
        return (
            <section key={entry.id} className="border-x border-b border-warning/15 bg-warning/[0.015]">
                <button type="button" aria-expanded={!condensed} onClick={() => onToggleGroup(entry.id)} className="flex h-8 w-full items-center gap-2 border-y border-warning/18 bg-warning/[0.045] px-3 text-left text-[9px] font-semibold uppercase tracking-[0.15em] text-warning/70 transition-colors hover:bg-warning/[0.08] hover:text-warning focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-warning">
                    {condensed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                    <span className="min-w-0 flex-1 truncate">{entry.title}</span>
                    <span className="font-mono font-normal tracking-normal text-warning/40">{condensed ? `${questIds.length} active` : `${questIds.length} quests`}</span>
                </button>
                {renderEntries(questIds.map((questId) => ({ kind: "quest", questId })))}
            </section>
        );
    });
    return renderEntries(model.entries);
}

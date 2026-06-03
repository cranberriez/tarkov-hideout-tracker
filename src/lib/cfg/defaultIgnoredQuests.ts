export interface DefaultIgnoredQuestGroup {
    label: string;
    questIds: string[];
}

export interface DefaultIgnoredQuestSection {
    trader: string;
    series: string;
    note?: string;
    groups: DefaultIgnoredQuestGroup[];
}

export const DEFAULT_IGNORED_QUEST_SECTIONS: DefaultIgnoredQuestSection[] = [
    {
        trader: "Mechanic",
        series: "Make Amends",
        groups: [
            {
                label: "Decoder fail once",
                questIds: [
                    "626148251ed3bb5bcc5bd9ed",
                    "6261482fa4eb80027c4f2e11",
                    "6391d90f4ed9512be67647df",
                ],
            },
            {
                label: "Decoder fail twice",
                questIds: [
                    "626148334149f1149b5b12ca",
                    "62614836f7308432be1d44cc",
                    "6391d912f8e5dd32bf4e3ab2",
                ],
            },
            {
                label: "Decoder fail thrice",
                questIds: [
                    "6261483ac48e6c62a440fab7",
                    "6261483dc4874104f230c0cd",
                    "6391d9144b15ca31f76bc323",
                ],
            },
        ],
    },
    {
        trader: "Mechanic",
        series: "Labyrinth quest series",
        groups: [
            {
                label: "Labrys research notes",
                questIds: ["67a0970f05d1611ed90be75d"],
            },
        ],
        note: "Not normally needed.",
    },
    {
        trader: "Fence",
        series: "The Collector",
        groups: [
            {
                label: "Streamer item hand-in",
                questIds: ["5c51aac186f77432ea65c552"],
            },
        ],
        note: "Contains many streamer items and likely deserves a dedicated page later.",
    },
];

export const DEFAULT_IGNORED_QUEST_IDS = DEFAULT_IGNORED_QUEST_SECTIONS.flatMap((section) =>
    section.groups.flatMap((group) => group.questIds),
);

export const DEFAULT_IGNORED_QUESTS: Record<string, boolean> = Object.fromEntries(
    DEFAULT_IGNORED_QUEST_IDS.map((questId) => [questId, true]),
);

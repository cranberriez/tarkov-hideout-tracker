"use client";

import type { Dispatch, SetStateAction } from "react";
import { Check, Minus, Plus, RotateCcw } from "lucide-react";
import { ItemDetailSection } from "./ItemDetailSection";

interface ItemDetailInventoryProps {
    draftNonFir: number;
    draftFir: number;
    setDraftNonFir: Dispatch<SetStateAction<number>>;
    setDraftFir: Dispatch<SetStateAction<number>>;
    hasChanges: boolean;
    onReset: () => void;
    onSave: () => void;
}

export function ItemDetailInventory({
    draftNonFir,
    draftFir,
    setDraftNonFir,
    setDraftFir,
    hasChanges,
    onReset,
    onSave,
}: ItemDetailInventoryProps) {
    return (
        <ItemDetailSection title="Inventory">
            <div className="space-y-1 bg-black/10">
                <CountControl label="Standard" value={draftNonFir} onChange={setDraftNonFir} />
                <CountControl
                    label="Found in raid"
                    value={draftFir}
                    onChange={setDraftFir}
                    fir
                />
            </div>

            {hasChanges && (
                <div className="mt-4 flex items-center justify-end gap-2 border-t border-border-color pt-4">
                    <button
                        type="button"
                        onClick={onReset}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
                    >
                        <RotateCcw size={13} />
                        Reset
                    </button>
                    <button
                        type="button"
                        onClick={onSave}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-tarkov-green/35 bg-tarkov-green/10 px-3 text-xs font-medium text-tarkov-green transition-colors hover:bg-tarkov-green/20"
                    >
                        <Check size={14} />
                        Save inventory
                    </button>
                </div>
            )}
        </ItemDetailSection>
    );
}

function CountControl({
    label,
    value,
    onChange,
    fir = false,
}: {
    label: string;
    value: number;
    onChange: Dispatch<SetStateAction<number>>;
    fir?: boolean;
}) {
    const updateFromInput = (rawValue: string) => {
        onChange(Math.max(0, Number.parseInt(rawValue || "0", 10)));
    };

    return (
        <div className="flex items-center justify-between gap-3 px-1 py-1">
            <div className="flex items-center gap-2 pl-1 text-sm text-foreground">
                <span
                    className={`h-2 w-2 rounded-full ${fir ? "bg-orange-400" : "bg-tarkov-green"}`}
                />
                {label}
            </div>
            <div className="flex items-center overflow-hidden rounded-md border border-border-color bg-black/35">
                <button
                    type="button"
                    onClick={() => onChange(Math.max(0, value - 1))}
                    className="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
                    aria-label={`Remove one ${label.toLowerCase()} item`}
                >
                    <Minus size={13} />
                </button>
                <input
                    type="number"
                    min={0}
                    value={value}
                    onChange={(event) => updateFromInput(event.target.value)}
                    className="h-8 w-12 border-x border-border-color bg-transparent text-center font-mono text-sm font-semibold text-foreground outline-none focus:bg-white/5"
                    aria-label={`${label} item count`}
                />
                <button
                    type="button"
                    onClick={() => onChange(value + 1)}
                    className="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
                    aria-label={`Add one ${label.toLowerCase()} item`}
                >
                    <Plus size={13} />
                </button>
            </div>
        </div>
    );
}

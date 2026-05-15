"use client";

import { CheckCircle, Circle } from "lucide-react";

interface ItemsCheckboxControlProps {
    id: string;
    label: string;
    checked: boolean;
    onCheckedChange: (value: boolean) => void;
    trailing?: React.ReactNode;
}

export function ItemsCheckboxControl({
    id,
    label,
    checked,
    onCheckedChange,
    trailing,
}: ItemsCheckboxControlProps) {
    return (
        <div className="flex items-center justify-between gap-3 px-1 py-1">
            <label htmlFor={id} className="flex cursor-pointer items-center gap-2">
                <input
                    id={id}
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => onCheckedChange(event.target.checked)}
                    className="sr-only"
                />
                <span className="text-gray-600 transition-colors hover:text-tarkov-green">
                    {checked ? (
                        <CheckCircle size={16} className="text-tarkov-green" />
                    ) : (
                        <Circle size={16} />
                    )}
                </span>
                <span className="text-xs font-medium text-gray-300">{label}</span>
            </label>
            <div className="flex items-center gap-2">{trailing}</div>
        </div>
    );
}

"use client";

import { CheckCircle, Circle } from "lucide-react";

interface FilterCheckboxProps {
    id: string;
    label: string;
    checked: boolean;
    onCheckedChange: (value: boolean) => void;
    trailing?: React.ReactNode;
}

export function FilterCheckbox({
    id,
    label,
    checked,
    onCheckedChange,
    trailing,
}: FilterCheckboxProps) {
    return (
        <div className="flex items-center justify-between gap-3 px-1 py-1">
            <label htmlFor={id} className="flex cursor-pointer items-center gap-2">
                <input
                    id={id}
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => onCheckedChange(event.target.checked)}
                    className="peer sr-only"
                />
                <span className="text-gray-600 transition-colors hover:text-tarkov-green peer-focus-visible:outline-2 peer-focus-visible:outline-tarkov-green">
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

"use client";

import { useEffect, useMemo, useState } from "react";
import { useDataStore } from "@/app/lib/stores/useDataStore";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ItemDetails } from "@/app/types";
import { Search, X } from "lucide-react";

interface ItemSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (item: ItemDetails) => void;
}

export function ItemSearchModal({ isOpen, onClose, onSelect }: ItemSearchModalProps) {
    const { items } = useDataStore();
    const [query, setQuery] = useState("");

    // Reset query when opening
    useEffect(() => {
        if (isOpen) {
            setQuery("");
        }
    }, [isOpen]);

    // Focus input on open
    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => {
                document.getElementById("item-search-input")?.focus();
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    // Handle Escape to close - Handled by Dialog
    // useEffect(() => { ... }, [isOpen, onClose]);

    const filteredItems = useMemo(() => {
        if (!items || !query) return [];

        const lowerQuery = query.toLowerCase();
        const allItems = Object.values(items);

        return allItems
            .filter((item) => item.name.toLowerCase().includes(lowerQuery))
            .sort((a, b) => {
                // Prioritize exact matches or starts with
                const aName = a.name.toLowerCase();
                const bName = b.name.toLowerCase();

                const aStarts = aName.startsWith(lowerQuery);
                const bStarts = bName.startsWith(lowerQuery);

                if (aStarts && !bStarts) return -1;
                if (!aStarts && bStarts) return 1;

                return aName.localeCompare(bName);
            })
            .slice(0, 50); // Limit results for performance
    }, [items, query]);

    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                showCloseButton={false}
                className="top-[15%] translate-y-0 w-full max-w-2xl max-h-[70vh] p-0 gap-0 bg-[#1a1a1a] border-white/10 overflow-hidden flex flex-col shadow-2xl"
            >
                <DialogTitle className="sr-only">Item Search</DialogTitle>
                <div className="p-4 border-b border-white/10 flex items-center gap-3 bg-[#111]">
                    <Search className="text-gray-400" size={20} />
                    <input
                        id="item-search-input"
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search items..."
                        className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-500 text-lg"
                        autoComplete="off"
                    />
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                <div className="overflow-y-auto">
                    {filteredItems.length > 0 ? (
                        <div className="divide-y divide-white/5">
                            {filteredItems.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => onSelect(item)}
                                    className="w-full px-4 py-3 flex items-center gap-4 hover:bg-white/5 transition-colors text-left"
                                >
                                    <div className="w-10 h-10 bg-black/40 border border-white/5 rounded flex items-center justify-center shrink-0 overflow-hidden">
                                        {item.iconLink ? (
                                            <img
                                                src={item.iconLink}
                                                alt={item.name}
                                                className="w-full h-full object-contain"
                                            />
                                        ) : (
                                            <span className="text-xs text-gray-600">?</span>
                                        )}
                                    </div>
                                    <div>
                                        <div className="text-gray-200 font-medium">{item.name}</div>
                                        <div className="text-xs text-gray-500">
                                            {item.category?.name}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : query ? (
                        <div className="p-8 text-center text-gray-500">
                            No items found matching "{query}"
                        </div>
                    ) : (
                        <div className="p-8 text-center text-gray-500">Type to search items...</div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

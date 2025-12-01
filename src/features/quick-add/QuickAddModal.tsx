"use client";

import { useState, useEffect, useMemo } from "react";
import { useUIStore } from "@/lib/stores/useUIStore";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useDataContext } from "@/app/(data)/_dataContext";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Plus, X, Search } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { ItemDetails } from "@/types";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PendingItem {
    tempId: string;
    item: ItemDetails;
    nonFir: number;
    fir: number;
}

export function QuickAddModal() {
    const { 
        isQuickAddOpen, 
        setQuickAddOpen, 
        pendingQuickAddItems, 
        setPendingQuickAddItems, 
        clearPendingQuickAddItems 
    } = useUIStore();
    const { items } = useDataContext();
    const { addItemCounts } = useUserStore();

    // State for the new item row
    const [isSearching, setIsSearching] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        if (!isQuickAddOpen) {
            // Reset search state when closed, but NOT the pending items
            setIsSearching(false);
            setSearchQuery("");
        }
    }, [isQuickAddOpen]);

    const searchResults = useMemo(() => {
        if (!searchQuery || !items) return [];
        
        const normalizedQuery = searchQuery.toLowerCase().replace(/\s+/g, "-");
        const strippedQuery = searchQuery.toLowerCase().replace(/[-\s]/g, "");
        const results: ItemDetails[] = [];
        
        const allItems = items;
        
        for (const item of allItems) {
            if (results.length >= 10) break;
            
            const nameMatch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
            const normalizedMatch = item.normalizedName.includes(normalizedQuery);
            const strippedMatch = item.normalizedName.replace(/-/g, "").includes(strippedQuery);
            
            if (nameMatch || normalizedMatch || strippedMatch) {
                results.push(item);
            }
        }
        
        return results;
    }, [searchQuery, items]);

    const handleAddItem = (item: ItemDetails) => {
        setPendingQuickAddItems([
            ...pendingQuickAddItems,
            {
                tempId: crypto.randomUUID(),
                item,
                nonFir: 0,
                fir: 0
            }
        ]);
        setIsSearching(false);
        setSearchQuery("");
    };

    const handleRemoveItem = (tempId: string) => {
        setPendingQuickAddItems(pendingQuickAddItems.filter(i => i.tempId !== tempId));
    };

    const updateItemCount = (tempId: string, type: "nonFir" | "fir", value: string) => {
        const numValue = parseInt(value) || 0;
        setPendingQuickAddItems(pendingQuickAddItems.map(item => {
            if (item.tempId === tempId) {
                return { ...item, [type]: numValue };
            }
            return item;
        }));
    };

    const handleSave = () => {
        pendingQuickAddItems.forEach(p => {
            if (p.nonFir > 0 || p.fir > 0) {
                addItemCounts(p.item.id, p.nonFir, p.fir);
            }
        });
        clearPendingQuickAddItems();
        setQuickAddOpen(false);
    };

    const handleCancel = () => {
        clearPendingQuickAddItems();
        setQuickAddOpen(false);
    };

    if (!isQuickAddOpen) return null;

    return (
        <Dialog open={isQuickAddOpen} onOpenChange={setQuickAddOpen}>
            <DialogContent className="w-full md:max-w-2xl bg-card border-border-color p-0 overflow-hidden flex flex-col max-h-[80vh]">
                <div className="p-4 border-b border-border-color bg-black/40">
                    <DialogTitle className="text-lg font-semibold">
                        Add Items from Raid
                    </DialogTitle>
                </div>

                <div className="flex-1 overflow-y-auto p-4 min-h-[50vh] space-y-3">
                    {/* Pending Items List */}
                    {pendingQuickAddItems.map((pending) => (
                        <div key={pending.tempId} className="flex flex-col sm:flex-row items-center gap-3 bg-secondary/20 p-3 rounded-md border border-border-color">
                            {/* Item Info */}
                            <div className="flex items-center gap-3 flex-1 w-full sm:w-auto">
                                <div className="relative w-10 h-10 min-w-10 bg-black/40 rounded border border-white/5 overflow-hidden">
                                    {pending.item.iconLink && (
                                        <Image 
                                            src={pending.item.iconLink} 
                                            alt={pending.item.name}
                                            fill
                                            className="object-contain"
                                        />
                                    )}
                                </div>
                                <span className="font-medium text-sm truncate" title={pending.item.name}>
                                    {pending.item.name}
                                </span>
                            </div>

                            {/* Inputs */}
                            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                                <div className="flex flex-col items-end gap-1">
                                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Non-FiR</label>
                                    <input 
                                        type="number" 
                                        min="0"
                                        value={pending.nonFir || ""}
                                        onChange={(e) => updateItemCount(pending.tempId, "nonFir", e.target.value)}
                                        placeholder="0"
                                        className="w-16 h-8 bg-black/40 border border-white/10 rounded px-2 text-sm text-right focus:outline-none focus:border-tarkov-green/50"
                                    />
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <label className="text-[10px] text-orange-500 uppercase tracking-wider font-bold">FiR</label>
                                    <input 
                                        type="number" 
                                        min="0"
                                        value={pending.fir || ""}
                                        onChange={(e) => updateItemCount(pending.tempId, "fir", e.target.value)}
                                        placeholder="0"
                                        className="w-16 h-8 bg-black/40 border border-white/10 rounded px-2 text-sm text-right focus:outline-none focus:border-tarkov-yellow/50"
                                    />
                                </div>
                                <button 
                                    onClick={() => handleRemoveItem(pending.tempId)}
                                    className="mt-4 text-red-500/70 hover:text-red-500 transition-colors p-1.5 cursor-pointer"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>
                    ))}

                    {/* Add New Item Row */}
                    <div className="relative">
                        {!isSearching ? (
                            <button 
                                onClick={() => setIsSearching(true)}
                                className="w-full h-12 border border-dashed border-white/20 rounded-md flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground hover:border-white/40 transition-all hover:bg-white/5 group"
                            >
                                <div className="w-6 h-6 rounded-full border border-current flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <Plus size={14} />
                                </div>
                                <span className="text-sm font-medium">Add Item</span>
                            </button>
                        ) : (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 h-12 bg-black/40 border border-tarkov-green/50 rounded-md px-3 focus-within:ring-1 ring-tarkov-green/50">
                                    <Search size={16} className="text-muted-foreground" />
                                    <input 
                                        autoFocus
                                        type="text" 
                                        placeholder="Search item name..." 
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground/50"
                                        onKeyDown={(e) => {
                                            if (e.key === "Escape") {
                                                setIsSearching(false);
                                                setSearchQuery("");
                                            }
                                        }}
                                    />
                                    <button 
                                        onClick={() => {
                                            setIsSearching(false);
                                            setSearchQuery("");
                                        }}
                                        className="text-muted-foreground hover:text-foreground"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>

                                {/* Search Results */}
                                {searchQuery && (
                                    <div className="bg-card border border-border-color rounded-md shadow-xl max-h-48 overflow-y-auto absolute w-full z-50 left-0 top-full mt-1">
                                        {!items && (
                                            <div className="p-3 text-center text-xs text-red-400">Error: Item data not loaded.</div>
                                        )}
                                        {items && searchResults.length === 0 && (
                                            <div className="p-3 text-center text-xs text-muted-foreground">No items found.</div>
                                        )}
                                        {searchResults.map((item) => (
                                            <button
                                                key={item.id}
                                                onClick={() => handleAddItem(item)}
                                                className="w-full flex items-center gap-3 p-2 hover:bg-white/5 text-left transition-colors border-b border-white/5 last:border-0"
                                            >
                                                <div className="relative w-8 h-8 min-w-8 bg-black/40 rounded overflow-hidden">
                                                    {item.iconLink && (
                                                        <Image 
                                                            src={item.iconLink} 
                                                            alt={item.name}
                                                            fill
                                                            className="object-contain"
                                                        />
                                                    )}
                                                </div>
                                                <span className="text-sm truncate text-gray-300">{item.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t border-border-color bg-black/40 flex justify-end gap-3">
                    <button 
                        onClick={handleCancel}
                        className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSave}
                        disabled={pendingQuickAddItems.length === 0}
                        className="px-4 py-2 bg-tarkov-green text-black text-sm font-bold rounded shadow-[0_0_10px_rgba(157,255,0,0.2)] hover:bg-tarkov-green-dim hover:shadow-[0_0_15px_rgba(157,255,0,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                    >
                        Add {pendingQuickAddItems.length} Item{pendingQuickAddItems.length !== 1 ? "s" : ""}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

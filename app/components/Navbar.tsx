"use client";

import Link from "next/link";
import Image from "next/image";
import { List, House, Settings } from "lucide-react";
import { useUserStore } from "@/app/lib/stores/useUserStore";

export function Navbar() {
    const setSetupOpen = useUserStore((state) => state.setSetupOpen);

    return (
        <nav className="border-b border-border-color bg-card">
            <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-6">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="relative w-8 h-8">
                        <Image
                            src="/images/hideout/Hideout_icon.webp"
                            alt="Tarkov Hideout Icon"
                            fill
                            className="object-contain"
                            loading="eager"
                        />
                    </div>
                    <div className="flex flex-col leading-none min-w-0">
                        <span className="font-bold text-base sm:text-lg tracking-tight sm:tracking-wide text-white truncate">
                            TARKOV HIDEOUT
                        </span>
                        <span className="text-[10px] sm:text-xs text-gray-500 tracking-wide">
                            STATION MANAGER
                        </span>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs sm:text-sm font-medium text-gray-400">
                    <button
                        onClick={() => setSetupOpen(true)}
                        className="hover:text-white transition-colors flex items-center gap-2"
                    >
                        <Settings size={16} />
                        Setup
                    </button>
                    <Link
                        href="/items"
                        className="hover:text-white transition-colors flex items-center gap-2"
                    >
                        <List size={16} />
                        Items
                    </Link>
                    <Link
                        href="/hideout"
                        className="hover:text-white transition-colors flex items-center gap-2"
                    >
                        <House size={16} />
                        Hideout
                    </Link>
                </div>
            </div>
        </nav>
    );
}

"use client";

import Link from "next/link";
import Image from "next/image";
import { List, House, Settings } from "lucide-react";
import { useUserStore } from "@/lib/stores/useUserStore";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const Links = [
    {
        name: "Items",
        href: "/items",
        icon: List,
    },
    {
        name: "Hideout",
        href: "/hideout",
        icon: House,
    },
];

export function Navbar() {
    const setSetupOpen = useUserStore((state) => state.setSetupOpen);
    const currentPage = usePathname();

    return (
        <nav className="border-b bg-card">
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
                    {Links.map((link) => (
                        <Link
                            key={link.name}
                            href={link.href}
                            className={cn(
                                "transition-colors flex items-center gap-2 p-2 rounded",
                                currentPage === link.href
                                    ? "text-card bg-foreground/80"
                                    : "hover:text-white"
                            )}
                        >
                            <link.icon size={16} />
                            {link.name}
                        </Link>
                    ))}
                    <button
                        onClick={() => setSetupOpen(true)}
                        className="hover:text-white transition-colors flex items-center gap-2 cursor-pointer"
                    >
                        <Settings size={16} />
                        Setup
                    </button>
                </div>
            </div>
        </nav>
    );
}

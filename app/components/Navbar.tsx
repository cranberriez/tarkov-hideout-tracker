import Link from "next/link";
import Image from "next/image";
import { List, House } from "lucide-react";

export function Navbar() {
    return (
        <nav className="border-b border-border-color bg-card">
            <div className="container mx-auto px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="relative w-8 h-8">
                        <Image
                            src="/images/hideout/Hideout_icon.webp"
                            alt="Tarkov Hideout Icon"
                            fill
                            className="object-contain"
                        />
                    </div>
                    <div className="flex flex-col leading-none">
                        <span className="font-bold text-lg tracking-wider text-white">
                            TARKOV HIDEOUT
                        </span>
                        <span className="text-xs text-gray-500 tracking-widest">
                            STATION MANAGER
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-6 text-sm font-medium text-gray-400">
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

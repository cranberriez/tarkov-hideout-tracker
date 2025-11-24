import Link from "next/link";
import Image from "next/image";

export function Navbar() {
    return (
        <nav className="border-b border-border-color bg-card px-6 py-4 flex items-center justify-between">
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
                    <span className="text-xs text-gray-500 tracking-widest">STATION MANAGER</span>
                </div>
            </div>

            <div className="flex items-center gap-6 text-sm font-medium text-gray-400">
                <Link
                    href="/items"
                    className="hover:text-white transition-colors flex items-center gap-2"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <line x1="8" y1="6" x2="21" y2="6"></line>
                        <line x1="8" y1="12" x2="21" y2="12"></line>
                        <line x1="8" y1="18" x2="21" y2="18"></line>
                        <line x1="3" y1="6" x2="3.01" y2="6"></line>
                        <line x1="3" y1="12" x2="3.01" y2="12"></line>
                        <line x1="3" y1="18" x2="3.01" y2="18"></line>
                    </svg>
                    Items
                </Link>
                <Link
                    href="/hideout"
                    className="hover:text-white transition-colors flex items-center gap-2"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M3 3v18h18" />
                        <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
                    </svg>
                    Stations
                </Link>
            </div>
        </nav>
    );
}

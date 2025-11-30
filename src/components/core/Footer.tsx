export function Footer() {
    return (
        <footer className="border-t border-border-color bg-card py-6 mt-10">
            <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-500">
                <div className="flex flex-col md:flex-row items-center gap-2 md:gap-3">
                    <span>
                        <a
                            href="https://github.com/cranberriez/tarkov-hideout-tracker"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="transition-colors text-tarkov-green-dim hover:text-tarkov-green hover:underline"
                        >
                            GitHub
                        </a>
                    </span>
                    <span>
                        Data provided by{" "}
                        <a
                            href="https://tarkov.dev/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="transition-colors text-tarkov-green-dim hover:text-tarkov-green hover:underline"
                        >
                            tarkov.dev
                        </a>
                    </span>
                    <span>
                        Price data powered by{" "}
                        <a
                            href="https://tarkov-market.com/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="transition-colors text-tarkov-green-dim hover:text-tarkov-green hover:underline"
                        >
                            tarkov-market.com
                        </a>
                    </span>
                    <span>
                        Escape from Tarkov{" "}
                        <a
                            href="https://escapefromtarkov.fandom.com/wiki/Escape_from_Tarkov_Wiki"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="transition-colors text-tarkov-green-dim hover:text-tarkov-green hover:underline"
                        >
                            Wiki
                        </a>
                    </span>
                </div>
                <div>Created by the community for the community. Not affiliated with BSG.</div>
            </div>
        </footer>
    );
}

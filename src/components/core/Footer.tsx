export function Footer() {
    return (
        <footer className="border-t border-border-color bg-card py-6 mt-10">
            <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-500">
                <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8">
                    <span>
                        Data provided by{" "}
                        <a
                            href="https://tarkov.dev/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-tarkov-green hover:underline"
                        >
                            tarkov.dev
                        </a>{" "}
                        API and price data powered by{" "}
                        <a
                            href="https://tarkov-market.com/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-tarkov-green hover:underline"
                        >
                            tarkov-market.com
                        </a>
                    </span>
                    <a
                        href="https://escapefromtarkov.fandom.com/wiki/Escape_from_Tarkov_Wiki"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-white transition-colors"
                    >
                        Escape from Tarkov Wiki
                    </a>
                </div>
                <div>Created by the community for the community. Not affiliated with BSG.</div>
            </div>
        </footer>
    );
}

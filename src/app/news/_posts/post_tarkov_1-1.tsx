import { NewsPost } from "@/features/news/NewsPost";

export function PostTarkov11() {
    return (
        <div id="tarkov-1-1-transition" className="scroll-mt-4">
            <NewsPost title="Preparing for Tarkov's First Season" date="August 3, 2026" version="3.1">
                <p className="text-lg">
                    Escape from Tarkov 1.1 introduces the first season and major changes to quests,
                    hideout progression, items, and other systems this tracker relies on.
                </p>

                <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-4">
                    <h3 className="mt-0 text-amber-100">Hideout items and upgrades should be accurate</h3>
                    <p>
                        Hideout item requirements and upgrade data have been updated for Tarkov 1.1.
                        Quest data is still being reviewed and may be incomplete or inaccurate for a
                        while, so verify quest requirements and progression decisions in game or with
                        another current source.
                    </p>
                </div>

                <p>
                    Quest data may take some time to catch up. Thank you for your patience while the
                    tracker finishes the transition to 1.1.
                </p>
            </NewsPost>
        </div>
    );
}

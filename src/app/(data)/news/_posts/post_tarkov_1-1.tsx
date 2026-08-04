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
                    <h3 className="mt-0 text-amber-100">Please do not rely on the tracker at launch</h3>
                    <p>
                        The tracker will keep its current data and will not be updated until I can
                        confirm the new data and site behavior are working correctly. Until this
                        notice is removed, verify requirements and progression decisions in game or
                        with another current source.
                    </p>
                </div>

                <p>
                    This may take some time. Thank you for your patience while the tracker catches
                    up with 1.1.
                </p>
            </NewsPost>
        </div>
    );
}

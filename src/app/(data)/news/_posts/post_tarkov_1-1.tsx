import { NewsPost } from "@/features/news/NewsPost";

export function PostTarkov11() {
    return (
        <div id="tarkov-1-1-transition" className="scroll-mt-4">
            <NewsPost title="Preparing for Tarkov's First Season" date="August 3, 2026" version="3.1">
                <p className="text-lg">
                    Escape from Tarkov 1.1 introduces the game&apos;s first season and major changes
                    to quests, hideout progression, items, and other supporting systems. Those
                    changes affect much of the data this tracker relies on.
                </p>

                <p>
                    After the update launches, parts of Tarkov Hideout Tracker may be incomplete or
                    inaccurate while the new progression structure is reviewed and the site&apos;s data
                    and logic are updated. This may take some time.
                </p>

                <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-4">
                    <h3 className="mt-0 text-amber-100">Please do not rely on the tracker at launch</h3>
                    <p>
                        Confirm quest requirements, prerequisites, hideout upgrades, item counts,
                        and progression decisions in the game or another current source before
                        spending or discarding items. Existing tracker data should be treated as
                        outdated until this notice is removed.
                    </p>
                </div>

                <p>
                    Updates will be rolled out as the new data becomes available and can be checked.
                    Thank you for your patience while the tracker catches up with 1.1.
                </p>
            </NewsPost>
        </div>
    );
}

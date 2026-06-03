import { NewsPost } from "@/features/news/NewsPost";
import { PostImage } from "@/features/news/ImagePlaceholder";

export function Post_v3_6_3() {
    return (
        <NewsPost title="Version 3.0 Quests Update" date="June 3, 2026" version="3.0">
            <p className="rounded-sm border border-tarkov-green-dim bg-secondary/20 p-2 text-center text-sm">
                Found something weird with quests? Report bugs or request fixes on the{" "}
                <a
                    href="https://github.com/cranberriez/tarkov-hideout-tracker/issues"
                    className="underline hover:text-tarkov-green"
                >
                    GitHub
                </a>
                .
            </p>

            <p className="text-lg">
                Version 3.0 adds quest tracking to the Tarkov Hideout Tracker. The goal is to make
                the app useful past hideout upgrades, especially for players keeping track of quest
                hand-ins, quest chains, and what items are still worth saving.
            </p>
            <p>
                The major additions are the new Quests page, quest items and quest item groups on
                the Items page with new filtering options, manual quest syncing for each trader,
                semi-automated log importing to help keep quests up to date, and a single place to
                adjust your character settings.
            </p>

            <h3 className="mt-4 text-xl font-semibold">Other Amazing Tarkov Tools</h3>
            <p>
                If you want more features, deeper progression tools, or probably more active
                development, please check out these amazing sites too. The current tarkovhideout.com
                site started as a pet project and learning tool for an early-career web developer.
            </p>
            <ul className="list-disc">
                <li>
                    <a href="https://ttracker.org/" className="underline hover:text-tarkov-green">
                        ttracker.org
                    </a>
                </li>
                <li>
                    <a
                        href="https://tarkovtracker.org/"
                        className="underline hover:text-tarkov-green"
                    >
                        tarkovtracker.org
                    </a>
                </li>
                <li>
                    <a href="https://kappas.pages.dev/" className="underline hover:text-tarkov-green">
                        kappas.pages.dev
                    </a>
                </li>
            </ul>

            <h3 className="mt-4 text-xl font-semibold">New Quests Page</h3>
            <p>
                There is now a full Quests page with Tarkov quest data, trader grouping, map
                grouping, search, filters, and completion tracking. You can view quests by tree, by
                trader, by map, or as one list depending on how you like to work through progression.
            </p>
            <p>
                Quest cards show the important information in one spot: objectives, prerequisites,
                unlocks, required keys, trader reputation changes, quest level, map, and whether the
                quest is part of Kappa or Lightkeeper progression.
            </p>
            <PostImage
                label="Screenshot of the new Quests page"
                src="/images/news/v3/quests-page.png"
            />

            <h3 className="mt-4 text-xl font-semibold">Quest Detail and Item Modals</h3>
            <p>
                Clicking a quest can open a more detailed view for objectives and quest chain
                context. Clicking item images can also open the same item detail modal used
                elsewhere in the app, so hideout and quest requirements are easier to compare in one
                place.
            </p>
            <PostImage
                label="Screenshot of a quest detail modal with objectives and required items"
                src="/images/news/v3/quest-detail-modal.png"
            />

            <h3 className="mt-4 text-xl font-semibold">Manual Quest Sync</h3>
            <p>
                A new manual sync flow can help rebuild your quest progress trader by trader. Select
                the quests you currently see in game for a trader and the app can complete
                prerequisite chains, handle failed quest branches, and avoid some risky assumptions
                around sensitive quest lines.
            </p>
            <p>
                There is also a semi-automated log import flow that can review recent game logs and
                help keep quest progress closer to your actual character. This is one of the bigger
                pieces of the update, and it is still meant to be reviewed before applying changes,
                but it should save a lot of time compared to checking every quest one by one.
            </p>
            <PostImage
                label="Screenshot of the manual quest sync flow"
                src="/images/news/v3/manual-quest-sync.png"
            />

            <h3 className="mt-4 text-xl font-semibold">Profile and Availability Filters</h3>
            <p>
                You can set player level, faction, prestige, and trader loyalty levels so the app
                can show which quests should be available for your character. There are also filters
                for completed quests, pinned quests, ignored quests, Kappa, Lightkeeper, FiR
                hand-ins, and quests with required items.
            </p>

            <h3 className="mt-4 text-xl font-semibold">Quest Items on the Items Page</h3>
            <p>
                Quest hand-in items are now connected to the Items page. This means your checklist
                can include both hideout items and quest items, while still keeping Found in Raid
                requirements separate where they matter.
            </p>
            <p>
                Quest item groups are supported too, so objectives that accept one of several items
                do not inflate the checklist like every item is required. New filtering options let
                you focus on hideout items, quest items, currently available quest demand, future
                quest demand, pinned quests, ignored quests, Kappa, Lightkeeper, and FiR items.
            </p>
            <PostImage
                label="Screenshot of quest items mixed into the Items checklist"
                src="/images/news/v3/items-with-quests.png"
            />

            <p className="border-l-2 border-yellow-500/80 bg-yellow-500/10 p-3 text-sm">
                Only one character profile is supported. Switching between PVP and PVE
                is currently used for market pricing and quest visibility, but it does not create a
                separate account or separate quest progress.
            </p>

            <div className="mt-4 rounded-lg border border-secondary/50 bg-secondary/20 p-4">
                <h3 className="mb-2 text-lg font-semibold">Going Forward</h3>
                <p>
                    Quest data can be messy, especially around item groups, branching quests, and
                    pre-wipe changes. Please report anything that looks wrong on GitHub so it can be
                    fixed and tracked cleanly.
                </p>
                <p>
                    This site will most likely continue to be a simple, focused tool for tracking
                    hideout and quest progress. If you want more features, deeper progression tools,
                    or probably more active development, please check out the other amazing sites
                    listed above.
                </p>
            </div>
        </NewsPost>
    );
}

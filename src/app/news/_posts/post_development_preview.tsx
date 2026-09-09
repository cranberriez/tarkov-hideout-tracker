import { NewsPost } from "@/features/news/NewsPost";
import { PostImage } from "@/features/news/ImagePlaceholder";

export function PostDevelopmentPreview() {
    return (
        <NewsPost title="A Look at the Next Update" date="September 9, 2026" version="Next">
            <p className="text-lg">
                A lot has been taking shape in the development branch: a rebuilt questing
                interface, separate player profiles, more useful item details, and new ways to
                compare barter and crafting profits.
            </p>
            <p>
                Here is a look at what is in development so far. Work will continue beyond these
                features, with more additions, fixes, and improvements along the way.
            </p>

            <h3>A new questing interface</h3>
            <p>
                The Quests page has been overhauled to make it easier to find your next task and
                keep track of what needs doing. Browse and filter your quests, then open one to
                see its objectives, required items, and rewards alongside the list.
            </p>
            <p>
                The quest visualizer helps you follow prerequisite chains. The Raid Planner
                brings objectives from your active quests onto a map, so you can see what to
                work on during your next raid.
            </p>
            {/* TEMP SCREENSHOT: Show the desktop Quests page with the quest list and a selected
                quest's objectives visible side by side. Add src to PostImage, then remove this comment. */}
            <PostImage label="Quest workspace screenshot" />
            {/* TEMP SCREENSHOT: Show the Raid Planner with several active quest markers on one
                map and an objective selected. Add src to PostImage, then remove this comment. */}
            <PostImage label="Raid Planner screenshot" />

            <h3>Separate player profiles</h3>
            <p>
                PVP, PVE, and KORD now have their own profiles. Each keeps its own quest progress,
                hideout upgrades, tracked inventory, and character settings. Switch profiles to
                pick up where you left off with that character.
            </p>
            {/* TEMP SCREENSHOT: Open the profile selector so PVP, PVE, and KORD are visible,
                with the active profile clearly marked. Add src to PostImage, then remove this comment. */}
            <PostImage label="Player profile selector screenshot" />

            <h3>More information in every item</h3>
            <p>
                The updated item window brings trader information, related crafts and barters,
                and pricing history together. Check trader offers, see where an item is used,
                and look at how its flea market price has changed without leaving the page.
            </p>
            {/* TEMP SCREENSHOT: Open an item with trader offers and related crafts. Show the
                trader information and crafting tab. Add src to PostImage, then remove this comment. */}
            <PostImage label="Item details with trader information and crafts screenshot" />
            {/* TEMP SCREENSHOT: Show the same item's price history with a populated chart.
                Add src to PostImage, then remove this comment. */}
            <PostImage label="Item pricing history screenshot" />

            <h3>Barter and crafting profit tables</h3>
            <p>
                New profit pages help you compare ingredient costs, sale proceeds, and estimated
                profit for barters and crafts. Sort crafts by profit per hour, filter the results,
                and adjust prices to match what you expect to pay or sell for.
            </p>
            <p>
                Estimates account for your unlocks and flea market selling fees. Prices can
                change, and costs such as fuel are not included, so use the figures as a guide.
            </p>
            {/* TEMP SCREENSHOT: Use a wide desktop view of Crafting Profits showing ingredients,
                cost, sale proceeds, profit, and profit/hour. Include a Barter Profits capture
                beside it or as a second image. Add src to PostImage, then remove this comment. */}
            <PostImage label="Crafting and barter profit tables screenshot" />

            <h3>More to come</h3>
            <p>
                These are the main additions so far, and development is ongoing. If something
                looks wrong or you have an idea that would make the tracker more useful, share it
                on{" "}
                <a
                    href="https://github.com/cranberriez/tarkov-hideout-tracker/issues"
                    className="underline hover:text-brand"
                >
                    GitHub
                </a>
                . Thanks for following along!
            </p>
        </NewsPost>
    );
}

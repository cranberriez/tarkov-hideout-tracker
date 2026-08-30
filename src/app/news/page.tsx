import { Post_v3_6_3 } from "./_posts/post_v3_6-3";
import { Post_v2_11_28 } from "./_posts/post_v2_11-28";
import { PostTarkov11 } from "./_posts/post_tarkov_1-1";

export default function NewsPage() {
    return (
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
            <div className="mb-10 flex flex-col gap-2">
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                    News & Updates
                </h1>
                <p className="text-sm leading-6 text-muted-foreground sm:text-[15px]">
                    Latest changes and additions to the Tarkov Hideout Tracker.
                </p>
            </div>

            <div className="flex flex-col gap-7">
                <PostTarkov11 />
                <Post_v3_6_3 />
                <Post_v2_11_28 />
            </div>
        </div>
    );
}

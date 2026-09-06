import { ClipboardList, Package, Warehouse } from "lucide-react";
import styles from "./RouteLoader.module.css";

const pages = {
    hideout: { Icon: Warehouse, title: "Hideout", code: "SEC / 01" },
    quests: { Icon: ClipboardList, title: "Quests", code: "OPS / 02" },
    items: { Icon: Package, title: "Items", code: "INV / 03" },
};

/** Page selects the map motif; title names the destination, including subpages. */
export function RouteLoader({ page = "hideout", title }: {
    page?: keyof typeof pages;
    title?: string;
}) {
    const { Icon, title: defaultTitle, code } = pages[page];
    const pageTitle = title ?? defaultTitle;
    return (
        <main className="flex min-h-80 flex-1 items-center justify-center px-6 py-12" aria-busy="true">
            <div role="status" aria-live="polite" className="w-full text-center">
                <span className="sr-only">Loading {pageTitle}</span>
                <div className={styles.loader} aria-hidden="true">
                    <div className={styles.mapCard}>
                        <svg viewBox="0 0 190 144" fill="none" className={styles.mapDrawing}>
                            <path className={styles.contour} d="M-10 38Q45-12 75 26T200 19" />
                            <path className={styles.contour} d="M-10 58Q42 9 74 46T200 39M-10 80Q48 34 85 66T200 60M-10 102Q40 51 90 88T200 82M-10 124Q40 75 97 110T200 104" />
                            <path className={styles.road} d="m8 144 24-53 42-10 30-55 64-17M0 72l67 12 51 47 72-9" />
                            <path className={styles.routePath} d={page === "quests" ? "M35 110 72 89 104 50 148 34" : page === "hideout" ? "M35 110 60 57 104 50 148 34" : "M35 110 94 113 130 77 148 34"} />
                            <circle cx="35" cy="110" r="3" fill="#665b42" />
                            <circle className={styles.destination} cx="148" cy="34" r="6" />
                        </svg>
                        <span className={styles.mapTape} />
                        <span className={styles.mapLegend}><Icon size={14} />{code}</span>
                    </div>
                    <div className={styles.pageName}>{pageTitle}</div>
                    <div className={styles.track}><div className={styles.signal} /></div>
                </div>
            </div>
        </main>
    );
}

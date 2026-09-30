"use client";

import {
    type ComponentOf,
    createModel,
    type LayoutJson,
    type TabOf,
} from "@fragiola/dockable";
import {
    Bell,
    Bookmark,
    FileText,
    ListTree,
    type LucideIcon,
    Search,
} from "lucide-react";
import { useState } from "react";
import { Card } from "../_kit/card";
import { type BorderOptions, DockLayout } from "../_kit/layout";
import * as styles from "../_kit/styles";

// A side border's tabs read vertically in the kit (`styles.borderTabVertical`: writing-mode, and
// half a turn more on a left border that reads "up"). Nothing in the package imposes it:
// Dockable.Border only lays its tab list out as a column, and exposes `data-orientation` and
// `data-tab-direction` for your CSS. The toggle below swaps class names, nothing else.

// What the layout holds: each tab component and the type of its data.
type Types = {
    tabs: {
        outline: { name: string };
        search: { name: string };
        bookmarks: { name: string };
        notes: { name: string };
        alerts: { name: string };
        card: { name: string };
    };
};

const json: LayoutJson<Types> = {
    version: 1,
    defaults: { border: { size: 220 } },
    borders: [
        {
            location: "left",
            selected: 0,
            children: [
                { component: "outline", data: { name: "Outline" } },
                { component: "search", data: { name: "Search" } },
                { component: "bookmarks", data: { name: "Bookmarks" } },
            ],
        },
        {
            location: "right",
            children: [
                { component: "notes", data: { name: "Notes" } },
                { component: "alerts", data: { name: "Alerts" } },
            ],
        },
    ],
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                children: [{ component: "card", data: { name: "Document" } }],
            },
        ],
    },
};

// the side panels' icons, by component (the document tab has none)
const icons: { [K in ComponentOf<Types>]?: LucideIcon } = {
    outline: ListTree,
    search: Search,
    bookmarks: Bookmark,
    notes: FileText,
    alerts: Bell,
};

function Label({ tab }: { tab: TabOf<Types> }) {
    const Icon = icons[tab.component];
    return (
        <>
            {Icon ? (
                <Icon aria-hidden="true" className="size-3.5 shrink-0" />
            ) : null}
            {tab.data.name}
        </>
    );
}

type Orientation = "vertical" | "horizontal";

const OPTIONS: Record<Orientation, BorderOptions<Types>> = {
    // the kit's default: no class given, so styles.borderTabVertical applies
    vertical: { renderBorderTab: (tab) => <Label tab={tab} /> },
    // upright labels: a class of its own replaces the rotation, and the strip grows to fit them
    horizontal: {
        renderBorderTab: (tab) => <Label tab={tab} />,
        borderTabClassName: "w-full",
        borderClassName: "data-[orientation=vertical]:w-auto",
    },
};

export default function BorderTabOrientation() {
    const [model] = useState(() => createModel<Types>(json));
    const [orientation, setOrientation] = useState<Orientation>("vertical");
    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className={styles.toolbar}>
                <fieldset className="flex items-center gap-1">
                    <legend className="sr-only">Side border labels</legend>
                    {(["vertical", "horizontal"] as const).map((value) => (
                        <button
                            key={value}
                            type="button"
                            data-testid={`labels-${value}`}
                            aria-pressed={orientation === value}
                            className={`${styles.button} aria-pressed:bg-palette-soft`}
                            onClick={() => setOrientation(value)}
                        >
                            {value === "vertical"
                                ? "Vertical labels"
                                : "Horizontal labels"}
                        </button>
                    ))}
                </fieldset>
            </div>
            <DockLayout
                model={model}
                borders={OPTIONS[orientation]}
                renderContent={(tab) => <Card tab={tab} />}
            />
        </div>
    );
}

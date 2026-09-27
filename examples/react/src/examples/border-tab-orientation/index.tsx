"use client";

import { type IJsonModel, Model, type TabNode } from "@fragiola/dockable";
import { Bell, Bookmark, FileText, ListTree, Search } from "lucide-react";
import { useState } from "react";
import { Card } from "../_kit/card";
import { type BorderOptions, DockLayout } from "../_kit/layout";
import * as styles from "../_kit/styles";

// A side border's tabs read vertically in the kit (`styles.borderTabVertical`: writing-mode, and
// half a turn more on a left border that reads "up"). Nothing in the package imposes it:
// Dockable.Border only lays its tab list out as a column, and exposes `data-orientation` and
// `data-tab-direction` for your CSS. The toggle below swaps class names, nothing else.

const json: IJsonModel = {
    global: { borderSize: 220 },
    borders: [
        {
            type: "border",
            location: "left",
            selected: 0,
            children: [
                { type: "tab", name: "Outline", component: "outline" },
                { type: "tab", name: "Search", component: "search" },
                { type: "tab", name: "Bookmarks", component: "bookmarks" },
            ],
        },
        {
            type: "border",
            location: "right",
            children: [
                { type: "tab", name: "Notes", component: "notes" },
                { type: "tab", name: "Alerts", component: "alerts" },
            ],
        },
    ],
    layout: {
        type: "row",
        children: [
            {
                type: "tabset",
                children: [
                    { type: "tab", name: "Document", component: "card" },
                ],
            },
        ],
    },
};

const icons = {
    outline: ListTree,
    search: Search,
    bookmarks: Bookmark,
    notes: FileText,
    alerts: Bell,
} as const;

function Label({ tab }: { tab: TabNode }) {
    const Icon = icons[tab.getComponent() as keyof typeof icons];
    return (
        <>
            {Icon ? (
                <Icon aria-hidden="true" className="size-3.5 shrink-0" />
            ) : null}
            {tab.getName()}
        </>
    );
}

type Orientation = "vertical" | "horizontal";

const OPTIONS: Record<Orientation, BorderOptions> = {
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
    const [model] = useState(() => Model.fromJson(json));
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

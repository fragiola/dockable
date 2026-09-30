"use client";

import { createModel, type LayoutJson } from "@fragiola/dockable";
import { useState } from "react";
import { Card } from "../_kit/card";
import { DockLayout } from "../_kit/layout";

// What the layout holds: one component, named in its data.
type Types = { tabs: { card: { name: string } } };

const json: LayoutJson<Types> = {
    version: 1,
    // the active tabset when the layout loads (the layout's, by id)
    active: "editors",
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                id: "editors",
                weight: 50,
                children: [
                    { component: "card", data: { name: "Editor" } },
                    { component: "card", data: { name: "Preview" } },
                ],
            },
            {
                type: "row",
                weight: 50,
                children: [
                    {
                        type: "tabset",
                        children: [
                            { component: "card", data: { name: "Outline" } },
                            { component: "card", data: { name: "Search" } },
                        ],
                    },
                    {
                        type: "tabset",
                        children: [
                            { component: "card", data: { name: "Problems" } },
                            { component: "card", data: { name: "Output" } },
                        ],
                    },
                ],
            },
        ],
    },
};

/**
 * The focused tab is the selected tab of the active tabset. `data-active` is on the active
 * `Dockable.TabSet`, `data-selected` on each tabset's selected `Dockable.Tab`; a tab does not know
 * whether its tabset is active, so these read the tabset's attribute from an ancestor with
 * `in-data-active:` (`:where([data-active]) &`). That is the workaround for gap 1 (no
 * `data-tabset-active` on `Tab`), and it works in any CSS: `[data-active] [data-selected] { … }`.
 */
const tab = [
    // every other tab (the rest of the active tabset, and all tabs of the other tabsets): faded
    "opacity-50 transition-opacity duration-(--dk-motion)",
    // the focused tab: full opacity, bold, and a 2px frame in the ring colour
    "in-data-active:data-selected:opacity-100 in-data-active:data-selected:font-semibold in-data-active:data-selected:text-palette-contrast",
    // (outline-solid: the kit's tab is outline-none)
    "in-data-active:data-selected:outline-2 in-data-active:data-selected:outline-solid in-data-active:data-selected:-outline-offset-2 in-data-active:data-selected:outline-palette-ring",
    // keyboard focus: a dashed frame, so it never reads as "the focused tab"
    "focus-visible:ring-0 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-dashed focus-visible:outline-palette-contrast",
].join(" ");

/** The active tabset's frame takes the ring colour. */
const tabset =
    "transition-colors duration-(--dk-motion) data-active:border-palette-ring";

export default function FocusedTab() {
    const [model] = useState(() => createModel<Types>(json));
    return (
        <DockLayout
            model={model}
            renderContent={(node) => <Card tab={node} />}
            tabClassName={tab}
            tabsetClassName={tabset}
        />
    );
}

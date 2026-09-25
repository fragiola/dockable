"use client";

import { type IJsonModel, Model } from "@fragiola/dockable";
import { useState } from "react";
import { Card } from "../_kit/card";
import { DockLayout } from "../_kit/layout";

const json: IJsonModel = {
    global: {},
    borders: [],
    layout: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 50,
                // the active tabset when the layout loads
                active: true,
                children: [
                    { type: "tab", name: "Editor", component: "card" },
                    { type: "tab", name: "Preview", component: "card" },
                ],
            },
            {
                type: "row",
                weight: 50,
                children: [
                    {
                        type: "tabset",
                        children: [
                            { type: "tab", name: "Outline", component: "card" },
                            { type: "tab", name: "Search", component: "card" },
                        ],
                    },
                    {
                        type: "tabset",
                        children: [
                            {
                                type: "tab",
                                name: "Problems",
                                component: "card",
                            },
                            { type: "tab", name: "Output", component: "card" },
                        ],
                    },
                ],
            },
        ],
    },
};

/**
 * `data-active` is on the active `Dockable.TabSet`, `data-selected` on each tabset's selected
 * `Dockable.Tab`. A tab does not know whether its tabset is active, so these read the tabset's
 * attribute from an ancestor with `in-data-active:` (`:where([data-active]) &`) and its
 * negation `not-in-data-active:`. That is the workaround for gap 1 (no `data-tabset-active`
 * on `Tab`), and it works in any CSS: `[data-active] [data-selected] { … }`.
 */
const tab = [
    // the selected tab of the active tabset: full contrast, bold, and the kit's marker line
    "in-data-active:data-selected:font-semibold in-data-active:data-selected:text-palette-contrast",
    // the selected tabs of the other tabsets: still selected, but quiet
    "not-in-data-active:data-selected:opacity-60",
    // keyboard focus: a clear ring, drawn outside the tab so the marker stays visible
    "focus-visible:ring-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-palette-ring",
].join(" ");

/** The active tabset's frame takes the ring colour. */
const tabset =
    "transition-colors duration-(--dk-motion) data-active:border-palette-ring";

export default function FocusedTab() {
    const [model] = useState(() => Model.fromJson(json));
    return (
        <DockLayout
            model={model}
            renderContent={(node) => <Card tab={node} />}
            tabClassName={tab}
            tabsetClassName={tabset}
        />
    );
}

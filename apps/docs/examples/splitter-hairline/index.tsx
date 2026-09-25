"use client";

import { type IJsonModel, Model } from "@fragiola/dockable";
import { Dockable, type RowSplitterProps } from "@fragiola/dockable-react";
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
                weight: 25,
                children: [
                    { type: "tab", name: "Explorer", component: "card" },
                ],
            },
            {
                type: "row",
                weight: 75,
                children: [
                    {
                        type: "tabset",
                        weight: 70,
                        children: [
                            { type: "tab", name: "main.ts", component: "card" },
                            {
                                type: "tab",
                                name: "utils.ts",
                                component: "card",
                            },
                        ],
                    },
                    {
                        type: "tabset",
                        weight: 30,
                        children: [
                            {
                                type: "tab",
                                name: "Terminal",
                                component: "card",
                            },
                        ],
                    },
                ],
            },
        ],
    },
};

/**
 * The splitter, VS Code style. The element itself is 1px: that is what the engine measures for
 * the split maths. The grab area is its `::after`, 7px wide and centred on the line, so the
 * pointer catches it 3px either side. The band fills only while `data-dragging` or on keyboard
 * focus, never on hover. `relative z-10` keeps the grab area above the tabsets and panels it
 * overlaps. `data-orientation` is the ARIA one: "vertical" is a bar between side-by-side panes.
 */
const hairline = [
    "relative z-10 shrink-0 bg-palette-line outline-none",
    "after:absolute after:transition-colors after:duration-(--dk-motion)",
    "data-dragging:after:bg-palette-ring focus-visible:after:bg-palette-ring",
    // a vertical bar between side-by-side panes
    "data-[orientation=vertical]:w-px data-[orientation=vertical]:cursor-ew-resize",
    "data-[orientation=vertical]:after:inset-y-0 data-[orientation=vertical]:after:start-1/2",
    "data-[orientation=vertical]:after:w-[7px] data-[orientation=vertical]:after:-translate-x-1/2",
    "rtl:data-[orientation=vertical]:after:translate-x-1/2",
    // a horizontal bar between stacked panes
    "data-[orientation=horizontal]:h-px data-[orientation=horizontal]:cursor-ns-resize",
    "data-[orientation=horizontal]:after:inset-x-0 data-[orientation=horizontal]:after:top-1/2",
    "data-[orientation=horizontal]:after:h-[7px] data-[orientation=horizontal]:after:-translate-y-1/2",
].join(" ");

function renderSplitter(props: RowSplitterProps) {
    return <Dockable.Splitter {...props} className={hairline} />;
}

export default function SplitterHairline() {
    const [model] = useState(() => Model.fromJson(json));
    return (
        <DockLayout
            model={model}
            renderContent={(tab) => <Card tab={tab} />}
            renderSplitter={renderSplitter}
            // Flush panes read best against a hairline: this example drops the theme's corners,
            // borders and shadow (its colours still come from the theme).
            className="[--dk-border:0px] [--dk-radius:0px] [--dk-shadow:none]"
        />
    );
}

"use client";

import { createModel, type LayoutJson, type TabOf } from "@fragiola/dockable";
import { FileCode2, ListTree, Search, SquareTerminal } from "lucide-react";
import { useState } from "react";
import { Card, PanelBody } from "../_kit/card";
import { LogPanel } from "../_kit/data";
import { DockLayout } from "../_kit/layout";

// Borders are part of the model (`borders` in its JSON): a strip of tabs on one side of the
// layout, whose selected tab opens a panel beside it. The kit renders them with Dockable.Borders
// (the frame), Dockable.Border (the strip) and Dockable.BorderContent (the panel area and its
// splitter); open one, resize it, or drag a tab between a border and the tabsets.

// Every component carries its tab's name in its data.
type Named = { name: string };
type Types = {
    tabs: {
        explorer: Named;
        search: Named;
        terminal: Named;
        outline: Named;
        card: Named;
    };
};

const json: LayoutJson<Types> = {
    version: 1,
    // every border's panel size, unless the border sets its own
    defaults: { border: { size: 220 } },
    borders: [
        {
            location: "left",
            selected: 0,
            children: [
                { component: "explorer", data: { name: "Explorer" } },
                { component: "search", data: { name: "Search" } },
            ],
        },
        {
            location: "bottom",
            size: 160,
            children: [
                { component: "terminal", data: { name: "Terminal" } },
                { component: "terminal", data: { name: "Output" } },
            ],
        },
        {
            location: "right",
            children: [{ component: "outline", data: { name: "Outline" } }],
        },
    ],
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                children: [
                    { component: "card", data: { name: "app.ts" } },
                    { component: "card", data: { name: "store.ts" } },
                ],
            },
        ],
    },
};

const FILES = ["src/app.ts", "src/store.ts", "src/theme.css", "README.md"];

// an icon per border component (the editors have none)
const icons: Partial<Record<TabOf<Types>["component"], typeof ListTree>> = {
    explorer: ListTree,
    search: Search,
    terminal: SquareTerminal,
    outline: FileCode2,
};

function BorderTabLabel({ tab }: { tab: TabOf<Types> }) {
    const Icon = icons[tab.component];
    return (
        <>
            {Icon ? <Icon aria-hidden="true" className="size-3.5" /> : null}
            {tab.data.name}
        </>
    );
}

function Content({ tab }: { tab: TabOf<Types> }) {
    switch (tab.component) {
        case "explorer":
            return (
                <PanelBody title="Explorer">
                    <ul className="flex flex-col gap-1 text-sm">
                        {FILES.map((file) => (
                            <li key={file} className="text-palette-accent/85">
                                {file}
                            </li>
                        ))}
                    </ul>
                </PanelBody>
            );
        case "search":
            return (
                <PanelBody title="Search">
                    <input
                        aria-label="Search files"
                        placeholder="Search"
                        className="h-8 rounded-md border border-palette-line bg-palette-soft px-3 text-sm"
                    />
                </PanelBody>
            );
        case "terminal":
            return <LogPanel />;
        case "outline":
            return (
                <PanelBody title="Outline">
                    <p className="text-sm text-palette-accent/85">
                        createApp · render · mount
                    </p>
                </PanelBody>
            );
        case "card":
            return <Card tab={tab} />;
    }
}

export default function Borders() {
    const [model] = useState(() => createModel<Types>(json));
    return (
        <DockLayout
            model={model}
            borders={{
                renderBorderTab: (tab) => <BorderTabLabel tab={tab} />,
            }}
            renderContent={(tab) => <Content tab={tab} />}
        />
    );
}

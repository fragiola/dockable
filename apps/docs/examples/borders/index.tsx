"use client";

import { type IJsonModel, Model, type TabNode } from "@fragiola/dockable";
import { FileCode2, ListTree, Search, SquareTerminal } from "lucide-react";
import { useState } from "react";
import { Card, PanelBody } from "../_kit/card";
import { LogPanel } from "../_kit/data";
import { DockLayout } from "../_kit/layout";

// Borders are part of the model (`borders` in its JSON): a strip of tabs on one side of the
// layout, whose selected tab opens a panel beside it. The kit renders them with Dockable.Borders
// (the frame), Dockable.Border (the strip) and Dockable.BorderContent (the panel area and its
// splitter); open one, resize it, or drag a tab between a border and the tabsets.

const json: IJsonModel = {
    global: { borderSize: 220 },
    borders: [
        {
            type: "border",
            location: "left",
            selected: 0,
            children: [
                { type: "tab", name: "Explorer", component: "explorer" },
                { type: "tab", name: "Search", component: "search" },
            ],
        },
        {
            type: "border",
            location: "bottom",
            size: 160,
            children: [
                { type: "tab", name: "Terminal", component: "terminal" },
                { type: "tab", name: "Output", component: "terminal" },
            ],
        },
        {
            type: "border",
            location: "right",
            children: [{ type: "tab", name: "Outline", component: "outline" }],
        },
    ],
    layout: {
        type: "row",
        children: [
            {
                type: "tabset",
                children: [
                    { type: "tab", name: "app.ts", component: "card" },
                    { type: "tab", name: "store.ts", component: "card" },
                ],
            },
        ],
    },
};

const FILES = ["src/app.ts", "src/store.ts", "src/theme.css", "README.md"];

const icons = {
    explorer: ListTree,
    search: Search,
    terminal: SquareTerminal,
    outline: FileCode2,
} as const;

function BorderTabLabel({ tab }: { tab: TabNode }) {
    const Icon = icons[tab.getComponent() as keyof typeof icons];
    return (
        <>
            {Icon ? <Icon aria-hidden="true" className="size-3.5" /> : null}
            {tab.getName()}
        </>
    );
}

function Content({ tab }: { tab: TabNode }) {
    switch (tab.getComponent()) {
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
        default:
            return <Card tab={tab} />;
    }
}

export default function Borders() {
    const [model] = useState(() => Model.fromJson(json));
    return (
        <DockLayout
            model={model}
            renderBorderTab={(tab) => <BorderTabLabel tab={tab} />}
            renderContent={(tab) => <Content tab={tab} />}
        />
    );
}

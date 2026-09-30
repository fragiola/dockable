"use client";

import { createModel, type LayoutJson } from "@fragiola/dockable";
import { useState } from "react";
import { Card } from "../_kit/card";
import { DockLayout } from "../_kit/layout";

// What the layout holds: each tab component and the type of its data.
type Types = { tabs: { card: { name: string } } };

// A layout is JSON: rows split space, tabsets hold tabs. Weights are relative sizes.
const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 60,
                children: [
                    { component: "card", data: { name: "Welcome" } },
                    { component: "card", data: { name: "Notes" } },
                ],
            },
            {
                type: "tabset",
                weight: 40,
                children: [{ component: "card", data: { name: "Inspector" } }],
            },
        ],
    },
};

export default function HelloLayout() {
    // The model is the source of truth: create it once, the layout renders from it.
    const [model] = useState(() => createModel<Types>(json));
    return (
        <DockLayout model={model} renderContent={(tab) => <Card tab={tab} />} />
    );
}

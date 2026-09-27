"use client";

import { type IJsonModel, Model } from "@fragiola/dockable";
import { useState } from "react";
import { Card } from "../_kit/card";
import { DockLayout } from "../_kit/layout";

// A layout is a JSON model: rows split space, tabsets hold tabs. Weights are relative sizes.
const json: IJsonModel = {
    global: {},
    borders: [],
    layout: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 60,
                children: [
                    { type: "tab", name: "Welcome", component: "card" },
                    { type: "tab", name: "Notes", component: "card" },
                ],
            },
            {
                type: "tabset",
                weight: 40,
                children: [
                    { type: "tab", name: "Inspector", component: "card" },
                ],
            },
        ],
    },
};

export default function HelloLayout() {
    // The model is the source of truth: create it once, the layout renders from it.
    const [model] = useState(() => Model.fromJson(json));
    return (
        <DockLayout model={model} renderContent={(tab) => <Card tab={tab} />} />
    );
}

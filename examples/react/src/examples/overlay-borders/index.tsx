"use client";

import {
    type BorderNode,
    createModel,
    type LayoutJson,
    type Model,
} from "@fragiola/dockable";
import { useState, useSyncExternalStore } from "react";
import { Card } from "../_kit/card";
import { LogPanel } from "../_kit/data";
import { DockLayout } from "../_kit/layout";
import * as styles from "../_kit/styles";

// Overlay borders (`mode: "overlay"`) open over the layout instead of beside it, and close on a
// press elsewhere in the layout or on Escape (keyMap.closeOverlayBorder). The toolbar switches a
// border's mode with the `border.configure` command. The right border is empty and `autoHide`: it
// shows up while a tab is dragged near the layout's right edge, so it can take the drop. The kit's
// edge indicators mark where a drop docks to an edge instead.

// What the layout holds: each tab component and the type of its data.
type Types = { tabs: { card: { name: string }; log: { name: string } } };

const json: LayoutJson<Types> = {
    version: 1,
    defaults: { border: { size: 240 } },
    borders: [
        {
            location: "left",
            mode: "overlay",
            children: [
                { component: "card", data: { name: "Inbox" } },
                { component: "card", data: { name: "Drafts" } },
            ],
        },
        {
            location: "bottom",
            mode: "overlay",
            size: 180,
            children: [{ component: "log", data: { name: "Console" } }],
        },
        {
            location: "right",
            autoHide: true,
            children: [],
        },
    ],
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 60,
                children: [
                    { component: "card", data: { name: "Message" } },
                    { component: "card", data: { name: "Calendar" } },
                ],
            },
            {
                type: "tabset",
                weight: 40,
                children: [{ component: "card", data: { name: "Contacts" } }],
            },
        ],
    },
};

const SWITCHABLE = ["left", "bottom"] as const;

function ModeSwitch({
    model,
    border,
}: {
    model: Model<Types>;
    border: BorderNode<Types>;
}) {
    // the border's mode, resolved against the layout defaults
    const overlay = model.resolve(border).mode === "overlay";
    const name = border.location;
    return (
        <button
            type="button"
            data-testid={`type-${name}`}
            className={styles.button}
            aria-pressed={overlay}
            onClick={() =>
                // a command on the model: it goes through the model's middleware like any change
                model.run("border.configure", {
                    border: border.id,
                    mode: overlay ? "docked" : "overlay",
                })
            }
        >
            {`${name[0]?.toUpperCase()}${name.slice(1)}: ${overlay ? "overlay" : "split"}`}
        </button>
    );
}

export default function OverlayBorders() {
    const [model] = useState(() => createModel<Types>(json));
    // the toolbar is outside the layout: it reads the borders from the model's state, and
    // re-renders on every change
    const state = useSyncExternalStore(
        model.subscribe,
        () => model.state,
        () => model.state,
    );
    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className={styles.toolbar}>
                {SWITCHABLE.map((location) => {
                    const border = state.borders.find(
                        (candidate) => candidate.location === location,
                    );
                    return border ? (
                        <ModeSwitch
                            key={location}
                            model={model}
                            border={border}
                        />
                    ) : null;
                })}
                <p className="ms-auto text-sm text-palette-accent/85">
                    Drag a tab towards the right edge (above or below its
                    middle) to reveal the hidden border.
                </p>
            </div>
            <DockLayout
                model={model}
                edgeIndicators
                renderContent={(tab) =>
                    tab.component === "log" ? <LogPanel /> : <Card tab={tab} />
                }
            />
        </div>
    );
}

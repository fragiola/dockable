"use client";

import {
    Actions,
    type BorderNode,
    DockLocation,
    type IJsonModel,
    LayoutEngine,
    Model,
} from "@fragiola/dockable";
import { useState } from "react";
import { Card } from "../_kit/card";
import { LogPanel } from "../_kit/data";
import { DockLayout } from "../_kit/layout";
import * as styles from "../_kit/styles";

// Overlay borders (`borderType: "overlay"`) open over the layout instead of beside it, and close
// on a press elsewhere in the layout or on Escape (keyMap.closeOverlayBorder). The toolbar switches
// a border's type with Actions.setBorderType. The right border is empty and `enableAutoHide`: it
// shows up while a tab is dragged near the layout's right edge, so it can take the drop. The kit's
// edge indicators mark where a drop docks to an edge instead.

const json: IJsonModel = {
    global: { borderSize: 240 },
    borders: [
        {
            type: "border",
            location: "left",
            borderType: "overlay",
            children: [
                { type: "tab", name: "Inbox", component: "card" },
                { type: "tab", name: "Drafts", component: "card" },
            ],
        },
        {
            type: "border",
            location: "bottom",
            borderType: "overlay",
            size: 180,
            children: [{ type: "tab", name: "Console", component: "log" }],
        },
        {
            type: "border",
            location: "right",
            enableAutoHide: true,
            children: [],
        },
    ],
    layout: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 60,
                children: [
                    { type: "tab", name: "Message", component: "card" },
                    { type: "tab", name: "Calendar", component: "card" },
                ],
            },
            {
                type: "tabset",
                weight: 40,
                children: [
                    { type: "tab", name: "Contacts", component: "card" },
                ],
            },
        ],
    },
};

const SWITCHABLE = [DockLocation.LEFT, DockLocation.BOTTOM];

function TypeSwitch({ model, border }: { model: Model; border: BorderNode }) {
    const overlay = border.isOverlay();
    const name = border.getLocation().getName();
    return (
        <button
            type="button"
            data-testid={`type-${name}`}
            className={styles.button}
            aria-pressed={overlay}
            onClick={() =>
                // through the engine, so onAction sees it; LayoutEngine.of finds the mounted one
                LayoutEngine.of(model)?.doAction(
                    Actions.setBorderType(
                        border.getId(),
                        overlay ? "split" : "overlay",
                    ),
                )
            }
        >
            {`${name[0]?.toUpperCase()}${name.slice(1)}: ${overlay ? "overlay" : "split"}`}
        </button>
    );
}

export default function OverlayBorders() {
    const [model] = useState(() => Model.fromJson(json));
    const [, setRevision] = useState(0);
    const borders = model.getBorderSet().getBorderMap();
    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className={styles.toolbar}>
                {SWITCHABLE.map((location) => {
                    const border = borders.get(location);
                    return border ? (
                        <TypeSwitch
                            key={location.getName()}
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
                // the toolbar reads the border types from the model
                onModelChange={() => setRevision((n) => n + 1)}
                renderContent={(tab) =>
                    tab.getComponent() === "log" ? (
                        <LogPanel />
                    ) : (
                        <Card tab={tab} />
                    )
                }
            />
        </div>
    );
}

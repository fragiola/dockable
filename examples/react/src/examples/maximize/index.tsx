"use client";

import {
    createModel,
    type LayoutJson,
    type Model,
    type TabsetNode,
} from "@fragiola/dockable";
import { useDockable } from "@fragiola/dockable-react";
import { Maximize2, Minimize2 } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { ChartPanel } from "../_kit/charts";
import { TablePanel } from "../_kit/data";
import { labels } from "../_kit/labels";
import { DockLayout } from "../_kit/layout";
import * as styles from "../_kit/styles";

// Maximize a tabset three ways: its header button, a double-click on the empty part of its strip,
// and Escape to restore. The styles read `data-maximized` (on the tabset and on the root); the
// splitters hide themselves while a tabset is maximized.

// What the layout holds: three components, each named in its data.
type Types = {
    tabs: {
        chart: { name: string };
        bars: { name: string };
        table: { name: string };
    };
};

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 60,
                children: [
                    { component: "chart", data: { name: "Revenue" } },
                    { component: "table", data: { name: "Orders" } },
                ],
            },
            {
                type: "row",
                weight: 40,
                children: [
                    {
                        type: "tabset",
                        children: [
                            { component: "bars", data: { name: "Signups" } },
                        ],
                    },
                    {
                        type: "tabset",
                        children: [
                            { component: "table", data: { name: "Latest" } },
                        ],
                    },
                ],
            },
        ],
    },
};

/** Whether the tabset may be maximized: the model answers without running the command. */
function canMaximize(model: Model<Types>, tabset: TabsetNode<Types>) {
    return model.can("tabset.maximize", { tabset: tabset.id, value: true }).ok;
}

function MaximizeButton({ tabset }: { tabset: TabsetNode<Types> }) {
    const { model, run, layoutId } = useDockable<Types>();
    const maximized = model.maximizedTabset(layoutId)?.id === tabset.id;
    if (!canMaximize(model, tabset)) {
        return null;
    }
    return (
        <button
            type="button"
            aria-label={maximized ? labels.restore : labels.maximize}
            aria-pressed={maximized}
            className={styles.iconButton}
            onClick={() =>
                run("tabset.maximize", { tabset: tabset.id, value: !maximized })
            }
        >
            {maximized ? (
                <Minimize2 aria-hidden className="size-3.5" />
            ) : (
                <Maximize2 aria-hidden className="size-3.5" />
            )}
        </button>
    );
}

/** The kit's header, plus: a double-click on the strip (not on a tab or a button) toggles. */
function Header({
    tabset,
    children,
}: {
    tabset: TabsetNode<Types>;
    children: ReactNode;
}) {
    const { model, run, layoutId } = useDockable<Types>();
    return (
        // biome-ignore lint/a11y/noStaticElementInteractions: a mouse shortcut; the button is the accessible way
        <div
            className="in-data-maximized:bg-palette-soft"
            onDoubleClick={(event) => {
                const target = event.target as Element;
                if (
                    !target.closest('[role="tab"], button') &&
                    canMaximize(model, tabset)
                ) {
                    run("tabset.maximize", {
                        tabset: tabset.id,
                        value:
                            model.maximizedTabset(layoutId)?.id !== tabset.id,
                    });
                }
            }}
        >
            {children}
        </div>
    );
}

/** Escape restores the maximized tabset, from anywhere in the page. */
function RestoreOnEscape() {
    const { engine, model, layoutId } = useDockable<Types>();
    useEffect(() => {
        const doc = engine.getCurrentDocument();
        if (!doc) {
            return;
        }
        const onKeyDown = (event: KeyboardEvent) => {
            const maximized = model.maximizedTabset(layoutId);
            if (
                event.key === "Escape" &&
                !event.defaultPrevented &&
                maximized
            ) {
                model.run("tabset.maximize", {
                    tabset: maximized.id,
                    value: false,
                });
            }
        };
        doc.addEventListener("keydown", onKeyDown);
        return () => doc.removeEventListener("keydown", onKeyDown);
    }, [engine, model, layoutId]);
    return null;
}

export default function Maximize() {
    const [model] = useState(() => createModel<Types>(json));
    return (
        <DockLayout
            model={model}
            // the maximized tabset is outlined and its header highlighted
            tabsetClassName="data-maximized:ring-2 data-maximized:ring-palette-ring data-maximized:ring-inset"
            renderActions={(tabset) => <MaximizeButton tabset={tabset} />}
            renderHeader={(tabset, header) => (
                <Header tabset={tabset}>{header}</Header>
            )}
            renderContent={(tab) => {
                switch (tab.component) {
                    case "chart":
                        return <ChartPanel kind="area" seed={3} />;
                    case "bars":
                        return <ChartPanel kind="bar" seed={19} />;
                    case "table":
                        return <TablePanel />;
                }
            }}
            className="data-maximized:bg-palette-soft"
        >
            <RestoreOnEscape />
        </DockLayout>
    );
}

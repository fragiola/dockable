"use client";

import {
    Actions,
    DockableLabel,
    type IJsonModel,
    Model,
    type TabSetNode,
} from "@fragiola/dockable";
import { useDockable } from "@fragiola/dockable-react";
import { Maximize2, Minimize2 } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { ChartPanel } from "../_kit/charts";
import { TablePanel } from "../_kit/data";
import { label } from "../_kit/labels";
import { DockLayout } from "../_kit/layout";
import * as styles from "../_kit/styles";

// Maximize a tabset three ways: its header button, a double-click on the empty part of its strip,
// and Escape to restore. The styles read `data-maximized` (on the tabset and on the root); the
// splitters hide themselves while a tabset is maximized.

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
                    { type: "tab", name: "Revenue", component: "chart" },
                    { type: "tab", name: "Orders", component: "table" },
                ],
            },
            {
                type: "row",
                weight: 40,
                children: [
                    {
                        type: "tabset",
                        children: [
                            { type: "tab", name: "Signups", component: "bars" },
                        ],
                    },
                    {
                        type: "tabset",
                        children: [
                            { type: "tab", name: "Latest", component: "table" },
                        ],
                    },
                ],
            },
        ],
    },
};

function MaximizeButton({ tabset }: { tabset: TabSetNode }) {
    const { engine, layoutId } = useDockable();
    const maximized = tabset.isMaximized();
    if (!tabset.isEnableMaximize()) {
        return null;
    }
    return (
        <button
            type="button"
            aria-label={label(
                maximized ? DockableLabel.Restore : DockableLabel.Maximize,
            )}
            aria-pressed={maximized}
            className={styles.iconButton}
            onClick={() =>
                engine.doAction(
                    Actions.maximizeToggle(tabset.getId(), layoutId),
                )
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
    tabset: TabSetNode;
    children: ReactNode;
}) {
    const { engine, layoutId } = useDockable();
    return (
        // biome-ignore lint/a11y/noStaticElementInteractions: a mouse shortcut; the button is the accessible way
        <div
            className="in-data-maximized:bg-palette-soft"
            onDoubleClick={(event) => {
                const target = event.target as Element;
                if (
                    !target.closest('[role="tab"], button') &&
                    tabset.isEnableMaximize()
                ) {
                    engine.doAction(
                        Actions.maximizeToggle(tabset.getId(), layoutId),
                    );
                }
            }}
        >
            {children}
        </div>
    );
}

/** Escape restores the maximized tabset, from anywhere in the page. */
function RestoreOnEscape() {
    const { engine, model, layoutId } = useDockable();
    useEffect(() => {
        const doc = engine.getCurrentDocument();
        if (!doc) {
            return;
        }
        const onKeyDown = (event: KeyboardEvent) => {
            const maximized = model.getMaximizedTabset(layoutId);
            if (
                event.key === "Escape" &&
                !event.defaultPrevented &&
                maximized
            ) {
                engine.doAction(
                    Actions.maximizeToggle(maximized.getId(), layoutId),
                );
            }
        };
        doc.addEventListener("keydown", onKeyDown);
        return () => doc.removeEventListener("keydown", onKeyDown);
    }, [engine, model, layoutId]);
    return null;
}

export default function Maximize() {
    const [model] = useState(() => Model.fromJson(json));
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
                switch (tab.getComponent()) {
                    case "chart":
                        return <ChartPanel kind="area" seed={3} />;
                    case "bars":
                        return <ChartPanel kind="bar" seed={19} />;
                    default:
                        return <TablePanel />;
                }
            }}
            className="data-maximized:bg-palette-soft"
        >
            <RestoreOnEscape />
        </DockLayout>
    );
}

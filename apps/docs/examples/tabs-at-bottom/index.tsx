"use client";

import { type IJsonModel, Model, type TabSetNode } from "@fragiola/dockable";
import { Dockable } from "@fragiola/dockable-react";
import { PanelBottom, PanelTop } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { Card } from "../_kit/card";
import { DockLayout } from "../_kit/layout";
import * as styles from "../_kit/styles";
import { KitTabButton, KitTabStrip } from "../_kit/tab-strip";

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
                    { type: "tab", name: "Sheet 1", component: "card" },
                    { type: "tab", name: "Sheet 2", component: "card" },
                    { type: "tab", name: "Sheet 3", component: "card" },
                ],
            },
            {
                type: "tabset",
                weight: 40,
                children: [
                    { type: "tab", name: "Console", component: "card" },
                    { type: "tab", name: "Watch", component: "card" },
                ],
            },
        ],
    },
};

type Position = "top" | "bottom";

/**
 * A tabset is a flex column (`Dockable.TabSet` sets `display: flex; flex-direction: column`),
 * and `Dockable.TabSetContent` takes the space left over. So the strip goes below the content
 * just by coming after it in the markup: the engine measures the content area wherever it is
 * and positions the panel over it.
 */
function TabSet({ node, position }: { node: TabSetNode; position: Position }) {
    const bottom = position === "bottom";
    const strip = (
        <KitTabStrip
            tabset={node}
            // below the content, the strip's rule moves to its top edge
            className={cn(bottom && "border-t border-b-0")}
        >
            {(tab) => (
                <KitTabButton
                    node={tab}
                    // and the tabs hang from it: rounded at the bottom, marker on top
                    className={cn(
                        bottom &&
                            "rounded-t-none rounded-b-(--dk-tab-radius) [&>[data-tab-marker]]:top-0 [&>[data-tab-marker]]:bottom-auto",
                    )}
                />
            )}
        </KitTabStrip>
    );
    return (
        <Dockable.TabSet node={node} className={styles.tabset}>
            {bottom ? null : strip}
            <Dockable.TabSetContent />
            {bottom ? strip : null}
        </Dockable.TabSet>
    );
}

export default function TabsAtBottom() {
    const [model] = useState(() => Model.fromJson(json));
    const [position, setPosition] = useState<Position>("bottom");
    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className={styles.toolbar}>
                <span className="text-sm text-palette-accent/85">Tabs</span>
                {(["top", "bottom"] as const).map((value) => (
                    <button
                        key={value}
                        type="button"
                        aria-pressed={position === value}
                        className={cn(
                            styles.button,
                            "aria-pressed:bg-palette-soft aria-pressed:font-medium",
                        )}
                        onClick={() => setPosition(value)}
                    >
                        {value === "top" ? (
                            <PanelTop aria-hidden className="size-4" />
                        ) : (
                            <PanelBottom aria-hidden className="size-4" />
                        )}
                        {value === "top" ? "Top" : "Bottom"}
                    </button>
                ))}
            </div>
            <DockLayout
                model={model}
                renderContent={(tab) => <Card tab={tab} />}
                renderTabSet={(tabset) => (
                    <TabSet node={tabset} position={position} />
                )}
                // The panel sits in a layer above the tabsets, so it repeats the tabset's
                // corner radius itself (gap 2): on the top corners when the strip is below.
                panelClassName={
                    position === "bottom"
                        ? "rounded-b-none rounded-t-[max(0px,calc(var(--dk-radius)-var(--dk-border)))]"
                        : undefined
                }
            />
        </div>
    );
}

"use client";

import {
    createModel,
    type LayoutJson,
    type TabsetNode,
} from "@fragiola/dockable";
import {
    Dockable,
    useDockable,
    useTabSetDropState,
} from "@fragiola/dockable-react";
import { useState } from "react";
import { cn } from "#/lib/cn";
import { Card } from "../_kit/card";
import { DockLayout } from "../_kit/layout";
import * as styles from "../_kit/styles";
import { KitTabButton, KitTabStrip } from "../_kit/tab-strip";

// No drop outline at all: the targets show themselves. While a drag would drop into (or beside) a
// tabset, it has `data-drop-target` and `data-drop-location` (center, top, bottom, left, right);
// a drop into its tab strip also gives the insertion index. The styles read only those.

// What the layout holds: one component, named in its data.
type Types = { tabs: { card: { name: string } } };

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 40,
                children: [
                    { component: "card", data: { name: "Alpha" } },
                    { component: "card", data: { name: "Beta" } },
                    { component: "card", data: { name: "Gamma" } },
                ],
            },
            {
                type: "row",
                weight: 60,
                children: [
                    {
                        type: "tabset",
                        children: [
                            { component: "card", data: { name: "Delta" } },
                            { component: "card", data: { name: "Epsilon" } },
                        ],
                    },
                    {
                        type: "tabset",
                        children: [
                            { component: "card", data: { name: "Zeta" } },
                        ],
                    },
                ],
            },
        ],
    },
};

/** A bar on the side of the tabset the drag would dock to (or all around, for the centre). */
const sideGlow = [
    "data-drop-target:ring-2 data-drop-target:ring-palette-ring/40",
    "data-[drop-location=center]:ring-4 data-[drop-location=center]:ring-palette-ring",
    "data-[drop-location=top]:shadow-[inset_0_4px_0_var(--palette-ring)]",
    "data-[drop-location=bottom]:shadow-[inset_0_-4px_0_var(--palette-ring)]",
    "data-[drop-location=left]:shadow-[inset_4px_0_0_var(--palette-ring)]",
    "data-[drop-location=right]:shadow-[inset_-4px_0_0_var(--palette-ring)]",
    "transition-shadow duration-(--dk-motion)",
].join(" ");

/** A caret before (or after) a tab, at the strip's insertion point. */
const caret =
    "before:pointer-events-none before:absolute before:inset-y-1 before:w-0.5 before:rounded-full before:bg-palette-ring";

function TabSet({ node }: { node: TabsetNode<Types> }) {
    const { engine } = useDockable<Types>();
    // the same answer the tabset's data-* come from: is a strip drop aimed here, and where?
    const drop = useTabSetDropState(engine, node.id);
    const tabs = node.children;
    return (
        <Dockable.TabSet node={node} className={cn(styles.tabset, sideGlow)}>
            <KitTabStrip tabset={node}>
                {(tab) => {
                    const index = tabs.findIndex((t) => t.id === tab.id);
                    const before = drop.strip && drop.index === index;
                    const after =
                        drop.strip &&
                        drop.index === tabs.length &&
                        index === tabs.length - 1;
                    return (
                        <KitTabButton
                            node={tab}
                            className={cn(
                                before && `${caret} before:-start-0.5`,
                                after && `${caret} before:-end-0.5`,
                            )}
                        />
                    );
                }}
            </KitTabStrip>
            <Dockable.TabSetContent />
        </Dockable.TabSet>
    );
}

export default function DropTargetHighlight() {
    const [model] = useState(() => createModel<Types>(json));
    return (
        <DockLayout
            model={model}
            renderContent={(tab) => <Card tab={tab} />}
            renderTabSet={(tabset) => <TabSet node={tabset} />}
            // the outline is replaced by the highlights above
            rootProps={{
                className: cn(
                    styles.root,
                    "[&_[data-layout-path='/outline']]:hidden",
                ),
            }}
        />
    );
}

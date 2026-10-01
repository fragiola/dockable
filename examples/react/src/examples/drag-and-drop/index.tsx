"use client";

import {
    createModel,
    type DropLocation,
    type LayoutJson,
} from "@fragiola/dockable";
import { Dockable } from "@fragiola/dockable-react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from "lucide-react";
import { useState } from "react";
import { cn } from "#/lib/cn";
import { Card } from "../_kit/card";
import { createRenderNode, KitEdgeIndicators } from "../_kit/layout";
import * as styles from "../_kit/styles";

// Drag tabs between tabsets and to the layout's edges. This example writes the Root itself (no
// DockLayout) to style the drop indicator: blue for a drop into a tabset (`kind: "rect"`), a
// dashed orange band for a drop at the layout's edge (`kind: "edge"`), an arrow for the side,
// and a transition as long as the root's `tabDragSpeed`. During a drag the kit's edge indicators
// (Dockable.EdgeIndicator) mark the four bands where a drop docks to an edge.

// What the layout holds: one component, named in its data.
type Types = { tabs: { card: { name: string } } };

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 50,
                children: [
                    { component: "card", data: { name: "Drag me" } },
                    { component: "card", data: { name: "Or me" } },
                    { component: "card", data: { name: "Me too" } },
                ],
            },
            {
                type: "row",
                weight: 50,
                children: [
                    {
                        type: "tabset",
                        children: [
                            { component: "card", data: { name: "Inbox" } },
                        ],
                    },
                    {
                        type: "tabset",
                        children: [
                            { component: "card", data: { name: "Outbox" } },
                        ],
                    },
                ],
            },
        ],
    },
};

const ARROWS: Partial<Record<DropLocation, typeof ArrowUp>> = {
    top: ArrowUp,
    bottom: ArrowDown,
    left: ArrowLeft,
    right: ArrowRight,
};

/**
 * The splitters and the tabset recursion, from the kit. The tabset the drag would drop into (or
 * beside) has `data-drop-target` (and `data-drop-location`), so it is styled from data alone.
 */
const { renderNode, renderSplitter } = createRenderNode<Types>({
    tabsetClassName:
        "data-drop-target:ring-2 data-drop-target:ring-palette-ring data-drop-target:ring-inset",
});

export default function DragAndDrop() {
    const [model] = useState(() => createModel<Types>(json));
    return (
        <div className={styles.frame}>
            <Dockable.Root
                model={model}
                // how long the indicator may take to move to the next target (exposed as data)
                tabDragSpeed={0.2}
                // while a tab of this layout is dragged, the panels fade back
                className={cn(
                    styles.root,
                    "[&_[role=tabpanel]]:transition-opacity data-dragging:[&_[role=tabpanel]]:opacity-60",
                )}
            >
                <Dockable.Row<Types> renderSplitter={renderSplitter}>
                    {renderNode}
                </Dockable.Row>
                <Dockable.Panels<Types>>
                    {(tab) => (
                        <Dockable.Panel
                            node={tab}
                            data-kit-panel=""
                            className={styles.panel}
                        >
                            <Card tab={tab} />
                        </Dockable.Panel>
                    )}
                </Dockable.Panels>
                <Dockable.DropIndicator
                    className={(state) =>
                        cn(
                            "z-20 grid place-items-center transition-[left,top,width,height] ease-out",
                            state.kind === "edge"
                                ? "palette-orange border-2 border-dashed border-palette-base bg-palette-base/30"
                                : "palette-blue rounded-(--dk-radius) border-2 border-palette-base bg-palette-base/15",
                        )
                    }
                    style={(state) => ({
                        transitionDuration: `${state.tabDragSpeed}s`,
                    })}
                    // a render function gets the state too: an arrow for the side it docks to
                    render={(props, state) => {
                        const Arrow = ARROWS[state.location];
                        return (
                            <div {...props}>
                                {Arrow ? (
                                    <Arrow className="size-5 text-palette-base" />
                                ) : null}
                            </div>
                        );
                    }}
                />
                {/* the edge docking targets, shown during a drag (solid under the pointer) */}
                <KitEdgeIndicators />
            </Dockable.Root>
        </div>
    );
}

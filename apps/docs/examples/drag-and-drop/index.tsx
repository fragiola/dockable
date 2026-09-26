"use client";

import { type DropLocation, type IJsonModel, Model } from "@fragiola/dockable";
import { Dockable } from "@fragiola/dockable-react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from "lucide-react";
import { type ComponentProps, useState } from "react";
import { cn } from "@/lib/cn";
import { Card } from "../_kit/card";
import { getLabel } from "../_kit/labels";
import { createRenderNode, KitEdgeIndicators } from "../_kit/layout";
import * as styles from "../_kit/styles";

// Drag tabs between tabsets and to the layout's edges. This example writes the Root itself (no
// DockLayout) to style the drop indicator: blue for a drop into a tabset (`kind: "rect"`), a
// dashed orange band for a drop at the layout's edge (`kind: "edge"`), an arrow for the side,
// and a transition as long as the root's `tabDragSpeed`. During a drag the kit's edge indicators
// (Dockable.EdgeIndicator) mark the four bands where a drop docks to an edge.

const json: IJsonModel = {
    global: {},
    borders: [],
    layout: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 50,
                children: [
                    { type: "tab", name: "Drag me", component: "card" },
                    { type: "tab", name: "Or me", component: "card" },
                    { type: "tab", name: "Me too", component: "card" },
                ],
            },
            {
                type: "row",
                weight: 50,
                children: [
                    {
                        type: "tabset",
                        children: [
                            { type: "tab", name: "Inbox", component: "card" },
                        ],
                    },
                    {
                        type: "tabset",
                        children: [
                            { type: "tab", name: "Outbox", component: "card" },
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
const { renderNode, renderSplitter } = createRenderNode({
    tabsetClassName:
        "data-drop-target:ring-2 data-drop-target:ring-palette-ring data-drop-target:ring-inset",
});

export default function DragAndDrop() {
    const [model] = useState(() => Model.fromJson(json));
    return (
        <div className={styles.frame}>
            <Dockable.Root
                model={model}
                getLabel={getLabel}
                // how long the indicator may take to move to the next target (exposed as data)
                tabDragSpeed={0.2}
                // while a tab of this layout is dragged, the panels fade back
                className={cn(
                    styles.root,
                    "[&_[role=tabpanel]]:transition-opacity data-dragging:[&_[role=tabpanel]]:opacity-60",
                )}
            >
                <Dockable.Row renderSplitter={renderSplitter}>
                    {renderNode}
                </Dockable.Row>
                <Dockable.Panels>
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
                            // the props are typed for any HTMLElement: a <div> needs the cast
                            <div {...(props as ComponentProps<"div">)}>
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

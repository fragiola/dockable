"use client";

import {
    type DropLocation,
    type IJsonModel,
    Model,
    TabSetNode,
} from "@fragiola/dockable";
import { Dockable, useDockable } from "@fragiola/dockable-react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from "lucide-react";
import { type ComponentProps, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { Card } from "../_kit/card";
import { getLabel } from "../_kit/labels";
import { createRenderNode } from "../_kit/layout";
import * as styles from "../_kit/styles";

// Drag tabs between tabsets and to the layout's edges. This example writes the Root itself (no
// DockLayout) to style the drop indicator: blue for a drop into a tabset (`kind: "rect"`), a
// dashed orange band for a drop at the layout's edge (`kind: "edge"`), an arrow for the side,
// and a transition as long as the root's `tabDragSpeed`.

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
 * The tabset the drop indicator is over, if any. The package does not say which tabset is the
 * target (gap 8), so this reads the indicator's rect from the core's drag-and-drop state and
 * finds the tabset that contains its centre.
 */
function useDropTargetTabset(): string | undefined {
    const { engine, model, layoutId } = useDockable();
    const manager = engine.getDragDropManager();
    const indicator = useSyncExternalStore(
        manager.subscribe,
        manager.getIndicatorState,
        manager.getIndicatorState,
    );
    if (!indicator.visible || indicator.kind !== "rect") {
        return undefined;
    }
    const centre = indicator.rect.getCenter();
    let target: string | undefined;
    model.visitLayoutNodes(layoutId, (node) => {
        if (
            node instanceof TabSetNode &&
            node.getRect().contains(centre.x, centre.y)
        ) {
            target = node.getId();
        }
    });
    return target;
}

/** The root row, with the target tabset highlighted (a class, since the kit's tabset takes no
 * extra attributes). */
function Layout() {
    const target = useDropTargetTabset();
    const { renderNode, renderSplitter } = createRenderNode({
        tabsetClassName: (tabset) =>
            tabset.getId() === target
                ? "ring-2 ring-palette-ring ring-inset"
                : "",
    });
    return (
        <Dockable.Row renderSplitter={renderSplitter}>
            {renderNode}
        </Dockable.Row>
    );
}

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
                <Layout />
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
            </Dockable.Root>
        </div>
    );
}

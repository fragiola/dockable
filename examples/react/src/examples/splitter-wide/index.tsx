"use client";

import {
    createModel,
    DockableLabel,
    getSplitterPath,
    type LayoutJson,
} from "@fragiola/dockable";
import {
    type RowSplitterProps,
    useDockable,
    useSplitter,
} from "@fragiola/dockable-react";
import { useState } from "react";
import { Card } from "../_kit/card";
import { DockLayout } from "../_kit/layout";

type Types = { tabs: { card: { name: string } } };

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 35,
                children: [{ component: "card", data: { name: "Library" } }],
            },
            {
                type: "row",
                weight: 65,
                children: [
                    {
                        type: "tabset",
                        weight: 60,
                        children: [
                            { component: "card", data: { name: "Draft" } },
                            { component: "card", data: { name: "Outline" } },
                        ],
                    },
                    {
                        type: "tabset",
                        weight: 40,
                        children: [
                            { component: "card", data: { name: "Comments" } },
                        ],
                    },
                ],
            },
        ],
    },
};

/**
 * A splitter built on the lower layer, `useSplitter`, instead of `Dockable.Splitter`: the hook
 * gives the controller (pointer and keyboard handling), its state (`dragging`) and the ARIA
 * values. The element is 12px thick (the engine measures it); a grip of three dots sits in
 * the middle, and while you drag or focus it a bubble shows `aria-valuenow`: where the
 * splitter sits in its row, from 0 to 100.
 */
function WideSplitter({ node, index }: RowSplitterProps<Types>) {
    const { controller, state, aria, hidden, ref } = useSplitter(node, index);
    // the accessible name comes from `getLabel` on the Root, as `Dockable.Splitter` does; the
    // path (`/r0/s0`) from the row's own, which the engine knows by id
    const { getLabel, engine } = useDockable<Types>();
    // `aria.orientation` is the separator's: "vertical" is a bar between side-by-side panes
    const vertical = aria.orientation === "vertical";
    return (
        // biome-ignore lint/a11y/useSemanticElements: a focusable separator widget with a grip; an <hr> cannot hold children
        <div
            ref={ref}
            role="separator"
            tabIndex={0}
            aria-label={getLabel?.(DockableLabel.Splitter)}
            aria-orientation={aria.orientation}
            aria-valuenow={aria.valueNow}
            aria-valuemin={aria.valueMin}
            aria-valuemax={aria.valueMax}
            aria-valuetext={aria.valueText}
            data-layout-path={getSplitterPath(engine.path(node.id), index)}
            data-orientation={aria.orientation}
            data-dragging={state.dragging ? "" : undefined}
            onPointerDown={(event) =>
                controller.onPointerDown(event.nativeEvent)
            }
            onKeyDown={(event) => {
                controller.onKeyDown(event.nativeEvent);
                if (event.nativeEvent.defaultPrevented) event.preventDefault();
            }}
            // structural only: hidden while a tabset is maximized
            style={hidden ? { display: "none" } : undefined}
            className={[
                "group/splitter relative z-10 flex shrink-0 items-center justify-center rounded-full outline-none",
                "transition-colors duration-(--dk-motion) hover:bg-palette-soft",
                "data-dragging:bg-palette-soft focus-visible:ring-2 focus-visible:ring-palette-ring",
                vertical
                    ? "w-3 cursor-ew-resize flex-col"
                    : "h-3 cursor-ns-resize flex-row",
            ].join(" ")}
        >
            {[0, 1, 2].map((dot) => (
                <span
                    key={dot}
                    aria-hidden="true"
                    className={[
                        "m-0.5 size-1 rounded-full bg-palette-line transition-colors",
                        "group-hover/splitter:bg-palette-accent group-data-dragging/splitter:bg-palette-ring",
                    ].join(" ")}
                />
            ))}
            <span
                aria-hidden="true"
                data-testid="splitter-readout"
                className={[
                    "palette-blue pointer-events-none absolute hidden rounded-md bg-palette-base px-1.5 py-0.5",
                    "text-xs font-medium tabular-nums text-palette-contrast shadow-sm",
                    "group-focus-visible/splitter:block group-data-dragging/splitter:block",
                    // just past the grip, centred on the bar
                    vertical
                        ? "start-1/2 top-[calc(50%+1.5rem)] -translate-x-1/2 rtl:translate-x-1/2"
                        : "start-[calc(50%+1.5rem)] top-1/2 -translate-y-1/2",
                ].join(" ")}
            >
                {aria.valueText}
            </span>
        </div>
    );
}

export default function SplitterWide() {
    const [model] = useState(() => createModel<Types>(json));
    return (
        <DockLayout
            model={model}
            renderContent={(tab) => <Card tab={tab} />}
            renderSplitter={(props) => <WideSplitter {...props} />}
        />
    );
}

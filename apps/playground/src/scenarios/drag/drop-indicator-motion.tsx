import { type IJsonModel, Model, type TabNode } from "@fragiola/dockable";
import { Dockable, type DropIndicatorState } from "@fragiola/dockable-react";
import { useState } from "react";
import { PanelBody } from "#/examples/_kit/card";
import { getLabel } from "#/examples/_kit/labels";
import { createRenderNode } from "#/examples/_kit/layout";
import * as styles from "#/examples/_kit/styles";
import { cn } from "#/lib/cn";

// The drop indicator with four motions side by side: drag a tab inside any layout and compare.
// The package only positions `Dockable.DropIndicator` (structural `left`/`top`/`width`/`height`,
// `display: none` when hidden); every transition is the consumer's CSS, so this is where they are
// tuned. Each layout has its own model: a drag stays inside its layout.

const json: IJsonModel = {
    global: {},
    borders: [],
    layout: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 55,
                children: [
                    { type: "tab", name: "Alpha", component: "body" },
                    { type: "tab", name: "Beta", component: "body" },
                ],
            },
            {
                type: "row",
                weight: 45,
                children: [
                    {
                        type: "tabset",
                        children: [
                            { type: "tab", name: "Gamma", component: "body" },
                        ],
                    },
                    {
                        type: "tabset",
                        children: [
                            { type: "tab", name: "Delta", component: "body" },
                        ],
                    },
                ],
            },
        ],
    },
};

const MOTIONS = [
    { name: "None", motion: "transition-none" },
    {
        name: "Ease out, 150ms",
        motion: "transition-[left,top,width,height] duration-150 ease-out",
    },
    {
        name: "Overshoot, 400ms",
        motion: "transition-[left,top,width,height] duration-400 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
    },
    {
        name: "Fade in (@starting-style), 200ms",
        motion: "transition-[left,top,width,height,opacity] duration-200 ease-out starting:opacity-0",
    },
] as const;

/** The kit's look (blue into a tabset, orange at an edge), without its motion. */
function look(state: DropIndicatorState) {
    return cn(
        "z-20 rounded-(--dk-radius) border-2 border-palette-base",
        state.kind === "edge"
            ? "palette-orange bg-palette-base/25"
            : "palette-blue bg-palette-base/20",
    );
}

function MotionLayout({ name, motion }: { name: string; motion: string }) {
    const [model] = useState(() => Model.fromJson(json));
    const { renderNode, renderSplitter } = createRenderNode();
    return (
        <section aria-label={name} className="flex min-h-0 flex-col gap-1">
            <h2 className="flex items-baseline gap-2 px-1 text-sm font-semibold">
                {name}
                <code className="truncate text-xs font-normal text-palette-accent/85">
                    {motion}
                </code>
            </h2>
            <div className="flex min-h-0 flex-1 flex-col">
                <Dockable.Root
                    model={model}
                    getLabel={getLabel}
                    className={styles.root}
                >
                    <Dockable.Row renderSplitter={renderSplitter}>
                        {renderNode}
                    </Dockable.Row>
                    <Dockable.Panels>
                        {(tab: TabNode) => (
                            <Dockable.Panel node={tab} className={styles.panel}>
                                <PanelBody title={tab.getName()} />
                            </Dockable.Panel>
                        )}
                    </Dockable.Panels>
                    <Dockable.DropIndicator
                        className={(state) => cn(look(state), motion)}
                    />
                </Dockable.Root>
            </div>
        </section>
    );
}

export default function DropIndicatorMotion() {
    return (
        <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-3 p-3">
            {MOTIONS.map((m) => (
                <MotionLayout key={m.name} name={m.name} motion={m.motion} />
            ))}
        </div>
    );
}

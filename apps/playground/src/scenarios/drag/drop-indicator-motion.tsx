import {
    createModel,
    Dockable,
    type DropIndicatorState,
    type LayoutJson,
    type RowNode,
    type RowSplitterProps,
    type TabsetNode,
} from "@fragiola/dockable-react";
import { useState } from "react";
import { PanelBody } from "#/examples/_kit/card";
import { cn } from "#/lib/cn";

// The drop indicator with four motions side by side: drag a tab inside any layout and compare.
// The package only positions `Dockable.DropIndicator` (structural `left`/`top`/`width`/`height`,
// `display: none` when hidden); every transition is the consumer's CSS, so this is where they are
// tuned. Each layout has its own model: a drag stays inside its layout.

type Types = { tabs: { body: undefined } };

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 55,
                children: [
                    { component: "body", label: "Alpha" },
                    { component: "body", label: "Beta" },
                ],
            },
            {
                type: "row",
                weight: 45,
                children: [
                    {
                        type: "tabset",
                        children: [{ component: "body", label: "Gamma" }],
                    },
                    {
                        type: "tabset",
                        children: [{ component: "body", label: "Delta" }],
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

/** The examples' look (blue into a tabset, orange at an edge), without their motion. */
function look(state: DropIndicatorState) {
    return cn(
        "z-20 rounded-(--dk-radius) border-2 border-palette-base",
        state.kind === "edge"
            ? "palette-orange bg-palette-base/25"
            : "palette-blue bg-palette-base/20",
    );
}

function MotionLayout({ name, motion }: { name: string; motion: string }) {
    const [model] = useState(() => createModel<Types>(json));
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
                    className="palette-surface min-h-0 flex-1 bg-palette-base font-(family-name:--dk-font) text-palette-contrast"
                >
                    <Dockable.Row<Types>
                        renderSplitter={(props) => <Splitter {...props} />}
                    >
                        {renderNode}
                    </Dockable.Row>
                    <Dockable.Panels<Types>>
                        {(tab) => (
                            <Dockable.Panel
                                node={tab}
                                className="palette-raised overflow-auto rounded-b-[max(0px,calc(var(--dk-radius)-var(--dk-border)))] bg-palette-base bg-(image:--dk-panel-texture) text-palette-contrast"
                            >
                                <PanelBody title={tab.label} />
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

/** A row's child: a tabset, or a nested row rendered by this same function. */
function renderNode(node: TabsetNode<Types> | RowNode<Types>) {
    if (node.type === "row") {
        return (
            <Dockable.Row
                node={node}
                renderSplitter={(props) => <Splitter {...props} />}
            >
                {renderNode}
            </Dockable.Row>
        );
    }
    return <TabSet node={node} />;
}

/** A tabset: the strip of tabs on top, the measured content area below. */
function TabSet({ node }: { node: TabsetNode<Types> }) {
    return (
        <Dockable.TabSet
            node={node}
            className="palette-raised rounded-(--dk-radius) border-(length:--dk-border) border-palette-line bg-palette-base text-palette-contrast shadow-(--dk-shadow) data-active:border-(--dk-tabset-active-line)"
        >
            <div className="flex min-h-(--dk-tab-height) items-stretch border-b border-palette-line">
                <Dockable.TabList<Types>
                    aria-label="Tabs"
                    className="flex min-w-0 flex-1 items-end gap-(--dk-tab-gap) overflow-hidden bg-(--dk-strip-bg) ps-[max(0.25rem,var(--dk-strip-padding))] pt-[calc(var(--dk-strip-padding)/2)]"
                >
                    {(tab) => (
                        <Dockable.Tab
                            node={tab}
                            className={cn(
                                "group/tab relative flex h-(--dk-tab-height) max-w-60 shrink-0 cursor-pointer select-none items-center gap-1.5 px-3",
                                "rounded-t-(--dk-tab-radius) font-(family-name:--dk-tab-font) text-(length:--dk-tab-size) text-palette-accent/85",
                                "border-e-(length:--dk-tab-divider) border-palette-line outline-none transition-colors duration-(--dk-motion) hover:bg-palette-soft",
                                "focus-visible:ring-2 focus-visible:ring-palette-ring focus-visible:ring-inset",
                                "data-selected:bg-(--dk-tab-selected-bg) data-selected:text-(--dk-tab-selected-fg) data-dragging:opacity-40",
                            )}
                        >
                            <span className="truncate">{tab.label}</span>
                            <span
                                aria-hidden="true"
                                className="palette-blue pointer-events-none absolute inset-x-2 bottom-0 hidden h-0.5 rounded-full bg-palette-base in-data-active:group-data-selected/tab:[display:var(--dk-tab-marker)]"
                            />
                        </Dockable.Tab>
                    )}
                </Dockable.TabList>
            </div>
            <Dockable.TabSetContent />
        </Dockable.TabSet>
    );
}

/** The bar between two children of a row, with a wider grab area (`::after`). */
function Splitter(props: RowSplitterProps<Types>) {
    return (
        <Dockable.Splitter
            {...props}
            aria-label="Resize"
            className={cn(
                "group/splitter relative z-10 flex shrink-0 items-center justify-center bg-(--dk-splitter-bg) outline-none",
                "after:absolute after:transition-colors after:duration-(--dk-motion)",
                "hover:after:bg-palette-ring/30 data-dragging:after:bg-palette-ring/60 focus-visible:after:bg-palette-ring/60",
                "data-[orientation=vertical]:w-(--dk-splitter-size) data-[orientation=vertical]:cursor-ew-resize",
                "data-[orientation=vertical]:after:inset-y-0 data-[orientation=vertical]:after:start-1/2",
                "data-[orientation=vertical]:after:w-(--dk-splitter-grab) data-[orientation=vertical]:after:-translate-x-1/2",
                "rtl:data-[orientation=vertical]:after:translate-x-1/2",
                "data-[orientation=horizontal]:h-(--dk-splitter-size) data-[orientation=horizontal]:cursor-ns-resize",
                "data-[orientation=horizontal]:after:inset-x-0 data-[orientation=horizontal]:after:top-1/2",
                "data-[orientation=horizontal]:after:h-(--dk-splitter-grab) data-[orientation=horizontal]:after:-translate-y-1/2",
            )}
        >
            <span
                aria-hidden="true"
                className={cn(
                    "pointer-events-none [display:var(--dk-grip)] rounded-full bg-palette-line",
                    "group-data-[orientation=vertical]/splitter:h-8 group-data-[orientation=vertical]/splitter:w-1",
                    "group-data-[orientation=horizontal]/splitter:h-1 group-data-[orientation=horizontal]/splitter:w-8",
                )}
            />
        </Dockable.Splitter>
    );
}

"use client";

import {
    createModel,
    type LayoutJson,
    type RowNode,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable";
import { Dockable, type RowSplitterProps } from "@fragiola/dockable-react";
import { type ReactNode, useId, useState } from "react";
import { Switch } from "#/components/ui/switch";
import { cn } from "#/lib/cn";
import { Card } from "../_kit/card";

// What the layout holds: one component, named in its data.
type Types = { tabs: { card: { name: string } } };

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 60,
                children: [
                    { component: "card", data: { name: "Welcome" } },
                    { component: "card", data: { name: "Notes" } },
                ],
            },
            {
                type: "row",
                weight: 40,
                children: [
                    {
                        type: "tabset",
                        children: [
                            { component: "card", data: { name: "Inspector" } },
                        ],
                    },
                    {
                        type: "tabset",
                        children: [
                            { component: "card", data: { name: "Output" } },
                        ],
                    },
                ],
            },
        ],
    },
};

export default function UnstyledExample() {
    // One model for both modes: switching remounts the view (a new engine for a new Root),
    // and the layout comes back exactly as you left it, because the model is the layout.
    const [model] = useState(() => createModel<Types>(json));
    const [styled, setStyled] = useState(false);
    const labelId = useId();

    /**
     * The whole recursion, with or without class names. Without them, every primitive renders a
     * plain `div` and sets only structural inline styles (flex sizing, `position`, geometry,
     * `display: none`); what you see is the browser's default rendering of that markup. The
     * children functions take the registry as a type argument (`Dockable.TabList<Types>`), so
     * `tab.data` is typed.
     */
    const renderNode = (node: TabsetNode<Types> | RowNode<Types>): ReactNode =>
        node.type === "row" ? (
            <Dockable.Row<Types> node={node} renderSplitter={renderSplitter}>
                {renderNode}
            </Dockable.Row>
        ) : (
            <TabSet node={node} styled={styled} />
        );

    /** A splitter has no name of its own: `Row` inserts it, so `renderSplitter` names it. */
    const renderSplitter = (props: RowSplitterProps<Types>) => (
        <Splitter {...props} styled={styled} />
    );

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="palette-surface flex flex-wrap items-center gap-2 border-b border-palette-line bg-palette-base px-3 py-2 text-palette-contrast">
                <span className="flex items-center gap-2 text-sm">
                    <Switch.Root
                        aria-labelledby={labelId}
                        data-testid="styles-toggle"
                        checked={styled}
                        onCheckedChange={setStyled}
                    >
                        <Switch.Thumb />
                    </Switch.Root>
                    <span id={labelId}>Styles</span>
                </span>
                <span className="text-sm text-palette-accent/85">
                    {styled
                        ? "Class names over the same primitives."
                        : "No CSS: only the structural inline styles the primitives set."}
                </span>
            </div>
            {/* The stage's theme sets an inherited font, colour and background. Without the
                styles, `all: initial` on this wrapper cuts that inheritance, so the layout below
                shows what the browser gives you with no CSS at all (black serif text on the
                canvas colour). It is the example's own element, not a Dockable primitive; an app
                would not need it. With the styles, it is the gutter around the layout: the
                root's row is `position: absolute; inset: 0`, so padding on the root would not
                move it. The key remounts the view when the switch flips. */}
            <div
                key={styled ? "styled" : "unstyled"}
                data-testid={styled ? undefined : "unstyled-frame"}
                className={
                    styled
                        ? "flex min-h-0 flex-1 flex-col p-(--dk-gap)"
                        : undefined
                }
                style={
                    styled
                        ? undefined
                        : {
                              all: "initial",
                              display: "flex",
                              flex: 1,
                              minHeight: 0,
                              background: "Canvas",
                              color: "CanvasText",
                          }
                }
            >
                <Dockable.Root
                    model={model}
                    className={
                        styled
                            ? "palette-surface min-h-0 flex-1 bg-palette-base font-(family-name:--dk-font) text-palette-contrast"
                            : undefined
                    }
                    // Root is `position: relative`; it only needs a size to lay out in.
                    style={styled ? undefined : { flex: 1 }}
                >
                    <Dockable.Row<Types> renderSplitter={renderSplitter}>
                        {renderNode}
                    </Dockable.Row>
                    <Dockable.Panels<Types>>
                        {(tab) => (
                            <Dockable.Panel
                                node={tab}
                                // panels sit in a layer above the tabsets, whose overflow cannot
                                // clip them: the panel repeats the tabset's inner radius on its
                                // corners
                                className={
                                    styled
                                        ? "palette-raised overflow-auto rounded-b-[max(0px,calc(var(--dk-radius)-var(--dk-border)))] bg-palette-base bg-(image:--dk-panel-texture) text-palette-contrast"
                                        : undefined
                                }
                            >
                                {styled ? (
                                    <Card name={tab.data.name} />
                                ) : (
                                    <PlainContent tab={tab} />
                                )}
                            </Dockable.Panel>
                        )}
                    </Dockable.Panels>
                    {/* Where a dragged tab would land: drawn only with the styles. Panels are
                        portalled into the root after it, so it needs a stacking order to paint
                        above them. */}
                    {styled ? (
                        <Dockable.DropIndicator
                            className={(state) =>
                                cn(
                                    "z-20 rounded-(--dk-radius) border-2 [border-style:var(--dk-indicator-style)] border-palette-base transition-[left,top,width,height]",
                                    state.kind === "edge"
                                        ? "palette-orange bg-palette-base/25"
                                        : "palette-blue bg-palette-base/20",
                                )
                            }
                            style={(state) => ({
                                transitionDuration: `${state.tabDragSpeed}s`,
                            })}
                        />
                    ) : null}
                </Dockable.Root>
            </div>
        </div>
    );
}

/** A tabset: with the styles, a card with the strip of tabs on top. */
function TabSet({
    node,
    styled,
}: {
    node: TabsetNode<Types>;
    styled: boolean;
}) {
    return (
        <Dockable.TabSet
            node={node}
            className={
                styled
                    ? "palette-raised rounded-(--dk-radius) border-(length:--dk-border) border-palette-line bg-palette-base text-palette-contrast shadow-(--dk-shadow) data-active:border-(--dk-tabset-active-line)"
                    : undefined
            }
        >
            <div
                className={
                    styled
                        ? "flex min-h-(--dk-tab-height) items-stretch border-b border-palette-line"
                        : undefined
                }
            >
                <Dockable.TabList<Types>
                    aria-label="Tabs"
                    // the start padding is load-bearing: a tab flush with the tabset's edge could
                    // not take a drop before it (that edge is the tabset's side drop)
                    className={
                        styled
                            ? "flex min-w-0 flex-1 items-end gap-(--dk-tab-gap) overflow-hidden bg-(--dk-strip-bg) ps-[max(0.25rem,var(--dk-strip-padding))] pt-[calc(var(--dk-strip-padding)/2)]"
                            : undefined
                    }
                >
                    {(tab) => (
                        <Dockable.Tab
                            node={tab}
                            className={
                                styled
                                    ? cn(
                                          "group/tab relative flex h-(--dk-tab-height) max-w-60 shrink-0 cursor-pointer select-none items-center gap-1.5 px-3",
                                          "rounded-t-(--dk-tab-radius) font-(family-name:--dk-tab-font) text-(length:--dk-tab-size) text-palette-accent/85",
                                          "border-e-(length:--dk-tab-divider) border-palette-line outline-none transition-colors duration-(--dk-motion) hover:bg-palette-soft",
                                          "focus-visible:ring-2 focus-visible:ring-palette-ring focus-visible:ring-inset",
                                          "data-selected:bg-(--dk-tab-selected-bg) data-selected:text-(--dk-tab-selected-fg) data-dragging:opacity-40",
                                      )
                                    : undefined
                            }
                        >
                            <span className={styled ? "truncate" : undefined}>
                                {tab.data.name}
                            </span>
                            {/* the active tabset's marker: `in-data-active:` reads the enclosing
                                TabSet's data-active, `group-data-selected/tab:` this tab's */}
                            {styled ? (
                                <span
                                    aria-hidden="true"
                                    className="palette-blue pointer-events-none absolute inset-x-2 bottom-0 hidden h-0.5 rounded-full bg-palette-base in-data-active:group-data-selected/tab:[display:var(--dk-tab-marker)]"
                                />
                            ) : null}
                        </Dockable.Tab>
                    )}
                </Dockable.TabList>
            </div>
            <Dockable.TabSetContent />
        </Dockable.TabSet>
    );
}

/**
 * The bar between two children of a row. With the styles: `--dk-splitter-size` thick (the engine
 * measures it), with a wider grab area (`::after`) and a grip for the themes that show one
 * (`--dk-grip`).
 */
function Splitter({
    styled,
    ...props
}: RowSplitterProps<Types> & { styled: boolean }) {
    return (
        <Dockable.Splitter
            {...props}
            aria-label="Resize"
            className={
                styled
                    ? cn(
                          "group/splitter relative z-10 flex shrink-0 items-center justify-center bg-(--dk-splitter-bg) outline-none",
                          "after:absolute after:transition-colors after:duration-(--dk-motion)",
                          "hover:after:bg-palette-ring/30 data-dragging:after:bg-palette-ring/60 focus-visible:after:bg-palette-ring/60",
                          // side by side: a vertical bar
                          "data-[orientation=vertical]:w-(--dk-splitter-size) data-[orientation=vertical]:cursor-ew-resize",
                          "data-[orientation=vertical]:after:inset-y-0 data-[orientation=vertical]:after:start-1/2",
                          "data-[orientation=vertical]:after:w-(--dk-splitter-grab) data-[orientation=vertical]:after:-translate-x-1/2",
                          "rtl:data-[orientation=vertical]:after:translate-x-1/2",
                          // stacked: a horizontal bar
                          "data-[orientation=horizontal]:h-(--dk-splitter-size) data-[orientation=horizontal]:cursor-ns-resize",
                          "data-[orientation=horizontal]:after:inset-x-0 data-[orientation=horizontal]:after:top-1/2",
                          "data-[orientation=horizontal]:after:h-(--dk-splitter-grab) data-[orientation=horizontal]:after:-translate-y-1/2",
                      )
                    : undefined
            }
        >
            {styled ? (
                <span
                    aria-hidden="true"
                    className={cn(
                        "pointer-events-none [display:var(--dk-grip)] rounded-full bg-palette-line",
                        "group-data-[orientation=vertical]/splitter:h-8 group-data-[orientation=vertical]/splitter:w-1",
                        "group-data-[orientation=horizontal]/splitter:h-1 group-data-[orientation=horizontal]/splitter:w-8",
                    )}
                />
            ) : null}
        </Dockable.Splitter>
    );
}

/** Unstyled content too: a panel renders whatever you give it, styled or not. */
function PlainContent({ tab }: { tab: TabOf<Types> }) {
    const [count, setCount] = useState(0);
    return (
        <div>
            <h2>{tab.data.name}</h2>
            <button type="button" onClick={() => setCount((c) => c + 1)}>
                {`Count: ${count}`}
            </button>
        </div>
    );
}

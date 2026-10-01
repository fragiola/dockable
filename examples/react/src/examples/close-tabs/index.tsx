"use client";

import {
    createModel,
    type LayoutJson,
    type RowNode,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable";
import {
    Dockable,
    type RowSplitterProps,
    useDockable,
} from "@fragiola/dockable-react";
import { Inbox, Lock, X } from "lucide-react";
import { useState } from "react";
import { cn } from "#/lib/cn";
import { Card } from "../_kit/card";

// What the layout holds: each tab component and the type of its data.
type Types = { tabs: { card: { name: string } } };

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 55,
                children: [
                    // this one has no close button, and ignores middle-click and Ctrl+Delete
                    {
                        component: "card",
                        data: { name: "Home" },
                        enableClose: false,
                    },
                    { component: "card", data: { name: "Report" } },
                    { component: "card", data: { name: "Draft" } },
                ],
            },
            {
                type: "row",
                weight: 45,
                children: [
                    {
                        type: "tabset",
                        // an empty tabset stays, and shows a hint, instead of disappearing
                        deleteWhenEmpty: false,
                        children: [
                            { component: "card", data: { name: "Inbox" } },
                        ],
                    },
                    {
                        type: "tabset",
                        children: [
                            { component: "card", data: { name: "Logs" } },
                            { component: "card", data: { name: "Metrics" } },
                        ],
                    },
                ],
            },
        ],
    },
};

export default function CloseTabs() {
    const [model] = useState(() => createModel<Types>(json));
    return (
        <div className="flex min-h-0 flex-1 flex-col p-(--dk-gap)">
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
                            // panels sit in a layer above the tabsets, whose overflow cannot clip
                            // them: the panel repeats the tabset's inner radius on its corners
                            className="palette-raised overflow-auto rounded-b-[max(0px,calc(var(--dk-radius)-var(--dk-border)))] bg-palette-base bg-(image:--dk-panel-texture) text-palette-contrast"
                        >
                            <Card name={tab.data.name} />
                        </Dockable.Panel>
                    )}
                </Dockable.Panels>
                {/* Panels are portalled into the root after the indicator: it needs a stacking
                    order to paint above them. */}
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
            </Dockable.Root>
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

function TabSet({ node }: { node: TabsetNode<Types> }) {
    return (
        <Dockable.TabSet
            node={node}
            // an empty tabset is styled from its `data-empty` attribute
            className="palette-raised rounded-(--dk-radius) border-(length:--dk-border) border-palette-line bg-palette-base text-palette-contrast shadow-(--dk-shadow) data-active:border-(--dk-tabset-active-line) data-empty:border-dashed data-empty:bg-palette-soft"
        >
            <div className="flex min-h-(--dk-tab-height) items-stretch border-b border-palette-line">
                <Dockable.TabList<Types>
                    aria-label="Tabs"
                    // the start padding is load-bearing: a tab flush with the tabset's edge could
                    // not take a drop before it (that edge is the tabset's side drop)
                    className="flex min-w-0 flex-1 items-end gap-(--dk-tab-gap) overflow-hidden bg-(--dk-strip-bg) ps-[max(0.25rem,var(--dk-strip-padding))] pt-[calc(var(--dk-strip-padding)/2)]"
                >
                    {(tab) => <ClosableTab tab={tab} />}
                </Dockable.TabList>
                <div className="flex items-center gap-0.5 pe-1">
                    <CloseTabsetButton tabset={node} />
                </div>
            </div>
            <Dockable.TabSetContent
                // No panel covers an empty tabset's content area, so it can show a hint.
                // `render` gets the element's props (its `ref` fits any element) and its state
                // ({ empty }).
                render={(props, state) => (
                    <div {...props}>
                        {state.empty ? (
                            <div className="grid h-full place-content-center justify-items-center gap-2 p-4 text-center text-sm text-palette-accent/85">
                                <Inbox aria-hidden className="size-6" />
                                <p>Nothing open. Drag a tab here.</p>
                            </div>
                        ) : null}
                    </div>
                )}
            />
        </Dockable.TabSet>
    );
}

/** A tab with its own close button, closed by a middle click too. */
function ClosableTab({ tab }: { tab: TabOf<Types> }) {
    const { model } = useDockable<Types>();
    // whether `tab.close` would apply: the tab's `enableClose` (resolved against the layout
    // defaults), not pinned, and no middleware veto. A dry run: nothing changes.
    const closeable = model.can("tab.close", { tab: tab.id });
    const close = () => model.run("tab.close", { tab: tab.id });
    return (
        <Dockable.Tab
            node={tab}
            className={cn(
                "group/tab relative flex h-(--dk-tab-height) max-w-60 shrink-0 cursor-pointer select-none items-center gap-1 px-3 pe-1.5",
                "rounded-t-(--dk-tab-radius) font-(family-name:--dk-tab-font) text-(length:--dk-tab-size) text-palette-accent/85",
                "border-e-(length:--dk-tab-divider) border-palette-line outline-none transition-colors duration-(--dk-motion) hover:bg-palette-soft",
                "focus-visible:ring-2 focus-visible:ring-palette-ring focus-visible:ring-inset",
                "data-selected:bg-(--dk-tab-selected-bg) data-selected:text-(--dk-tab-selected-fg) data-dragging:opacity-40",
            )}
            onAuxClick={(event) => {
                if (event.button === 1 && closeable) {
                    event.preventDefault();
                    close();
                }
            }}
        >
            <span className="truncate">{tab.data.name}</span>
            {closeable ? (
                <button
                    type="button"
                    // the keyboard closes with Ctrl+Delete on the tab itself (the keyMap's
                    // closeTab), so the button is left out of the tab order
                    tabIndex={-1}
                    aria-label={`Close ${tab.data.name}`}
                    className={cn(
                        "grid size-5 shrink-0 place-items-center self-center rounded-sm text-palette-accent/85",
                        "outline-none hover:bg-palette-soft hover:text-palette-contrast",
                        "focus-visible:ring-2 focus-visible:ring-palette-ring",
                        "disabled:pointer-events-none disabled:opacity-40",
                    )}
                    // keep the press from selecting the tab or starting a drag
                    onPointerDown={(event) => event.stopPropagation()}
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                        event.stopPropagation();
                        close();
                    }}
                >
                    <X aria-hidden className="size-3.5" />
                </button>
            ) : (
                <Lock
                    aria-hidden
                    className="me-1 size-3 text-palette-accent/85"
                />
            )}
            {/* the active tabset's marker: `in-data-active:` reads the enclosing TabSet's
                data-active, `group-data-selected/tab:` this tab's */}
            <span
                aria-hidden="true"
                className="palette-blue pointer-events-none absolute inset-x-2 bottom-0 hidden h-0.5 rounded-full bg-palette-base in-data-active:group-data-selected/tab:[display:var(--dk-tab-marker)]"
            />
        </Dockable.Tab>
    );
}

function CloseTabsetButton({ tabset }: { tabset: TabsetNode<Types> }) {
    const { model } = useDockable<Types>();
    if (tabset.children.length === 0) return null;
    return (
        <button
            type="button"
            aria-label="Close tabset"
            className={cn(
                "grid size-6 shrink-0 place-items-center self-center rounded-sm text-palette-accent/85",
                "outline-none hover:bg-palette-soft hover:text-palette-contrast",
                "focus-visible:ring-2 focus-visible:ring-palette-ring",
                "disabled:pointer-events-none disabled:opacity-40",
            )}
            // closes every closeable tab; the tabset goes too once it is empty
            onClick={() => model.run("tabset.close", { tabset: tabset.id })}
        >
            <X aria-hidden className="size-4" />
        </button>
    );
}

/**
 * The bar between two children of a row: `--dk-splitter-size` thick (the engine measures it), with
 * a wider grab area (`::after`) and a grip for the themes that show one (`--dk-grip`).
 */
function Splitter(props: RowSplitterProps<Types>) {
    return (
        <Dockable.Splitter
            {...props}
            aria-label="Resize"
            className={cn(
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

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
import { useState } from "react";
import { cn } from "#/lib/cn";
import { Card } from "../_kit/card";
import { RenameField } from "../_kit/rename-field";

// Inline rename: double-click a tab (or press F2 on it) and type. Enter confirms, Escape cancels,
// an empty name is refused. The package has no rename UI: the name is the app's own data, and
// renaming is the `tab.update` command with the new data. Whether a tab may be renamed is the
// app's too (`renamable` in its data).

// What the layout holds: one component, whose data is the name and the rename permission.
type Types = { tabs: { card: { name: string; renamable?: boolean } } };

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 55,
                children: [
                    { component: "card", data: { name: "Untitled" } },
                    { component: "card", data: { name: "Sketch" } },
                    {
                        component: "card",
                        // this one cannot be renamed
                        data: { name: "Fixed name", renamable: false },
                    },
                ],
            },
            {
                type: "tabset",
                weight: 45,
                children: [{ component: "card", data: { name: "Ideas" } }],
            },
        ],
    },
};

export default function RenameTabs() {
    const [model] = useState(() => createModel<Types>(json));
    // one tab at most is being renamed
    const [editing, setEditing] = useState<string | null>(null);

    /** A row's child: a tabset, or a nested row rendered by this same function. */
    const renderNode = (node: TabsetNode<Types> | RowNode<Types>) =>
        node.type === "row" ? (
            <Dockable.Row
                node={node}
                renderSplitter={(props) => <Splitter {...props} />}
            >
                {renderNode}
            </Dockable.Row>
        ) : (
            <TabSet node={node} editing={editing} setEditing={setEditing} />
        );

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
                            <Card name={tab.data.name}>
                                <p className="text-sm text-palette-accent/85">
                                    Double-click a tab, or focus it and press
                                    F2, to rename it.
                                </p>
                            </Card>
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

/** A tabset: a card with the strip of renamable tabs on top and the measured content area below. */
function TabSet({
    node,
    editing,
    setEditing,
}: {
    node: TabsetNode<Types>;
    /** the tab being renamed (its id) */
    editing: string | null;
    setEditing: (id: string | null) => void;
}) {
    return (
        <Dockable.TabSet
            node={node}
            className="palette-raised rounded-(--dk-radius) border-(length:--dk-border) border-palette-line bg-palette-base text-palette-contrast shadow-(--dk-shadow) data-active:border-(--dk-tabset-active-line)"
        >
            <div className="flex min-h-(--dk-tab-height) items-stretch border-b border-palette-line">
                <Dockable.TabList<Types>
                    aria-label="Tabs"
                    // the start padding is load-bearing: a tab flush with the tabset's edge could
                    // not take a drop before it (that edge is the tabset's side drop)
                    className="flex min-w-0 flex-1 items-end gap-(--dk-tab-gap) overflow-hidden bg-(--dk-strip-bg) ps-[max(0.25rem,var(--dk-strip-padding))] pt-[calc(var(--dk-strip-padding)/2)]"
                >
                    {(tab) => (
                        <RenamableTab
                            tab={tab}
                            editing={editing === tab.id}
                            setEditing={setEditing}
                        />
                    )}
                </Dockable.TabList>
            </div>
            <Dockable.TabSetContent />
        </Dockable.TabSet>
    );
}

function RenamableTab({
    tab,
    editing,
    setEditing,
}: {
    tab: TabOf<Types>;
    editing: boolean;
    setEditing: (id: string | null) => void;
}) {
    const { run } = useDockable<Types>();
    const start = () => {
        if (tab.data.renamable !== false) {
            setEditing(tab.id);
        }
    };
    return (
        <Dockable.Tab
            node={tab}
            className={cn(
                "group/tab relative flex h-(--dk-tab-height) max-w-60 shrink-0 cursor-pointer select-none items-center gap-1.5 px-3",
                "rounded-t-(--dk-tab-radius) font-(family-name:--dk-tab-font) text-(length:--dk-tab-size) text-palette-accent/85",
                "border-e-(length:--dk-tab-divider) border-palette-line outline-none transition-colors duration-(--dk-motion) hover:bg-palette-soft",
                "focus-visible:ring-2 focus-visible:ring-palette-ring focus-visible:ring-inset",
                "data-selected:bg-(--dk-tab-selected-bg) data-selected:text-(--dk-tab-selected-fg) data-dragging:opacity-40",
            )}
            onDoubleClick={start}
            onKeyDown={(event) => {
                if (event.key === "F2") {
                    start();
                }
            }}
            // no drag while editing, so the mouse can select text in the field
            draggable={editing ? false : undefined}
        >
            {editing ? (
                <RenameField
                    name={tab.data.name}
                    onCommit={(name) => {
                        // the new data is the whole value: keep the rest of it
                        run("tab.update", {
                            tab: tab.id,
                            component: tab.component,
                            data: { ...tab.data, name },
                        });
                        setEditing(null);
                    }}
                    onCancel={() => setEditing(null)}
                />
            ) : (
                <span className="truncate">{tab.data.name}</span>
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

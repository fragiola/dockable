"use client";

import {
    createModel,
    type IKeyMap,
    type LayoutJson,
    type RowNode,
    resolveKeyMap,
    type TabOf,
    type TabsetNode,
    toAriaKeyShortcuts,
} from "@fragiola/dockable";
import {
    Dockable,
    type RowSplitterProps,
    useDockable,
} from "@fragiola/dockable-react";
import { useState } from "react";
import { Tooltip } from "#/components/ui/tooltip";
import { cn } from "#/lib/cn";
import { Card, PanelBody } from "../_kit/card";

type Types = {
    tabs: { keys: { name: string }; card: { name: string } };
    // a tabset's name is its tab list's accessible name (the TabSet below reads `data.name`)
    tabset: { name: string };
};

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                id: "documents",
                data: { name: "Documents" },
                weight: 55,
                children: [
                    { component: "keys", data: { name: "Keys" } },
                    { component: "card", data: { name: "Readme" } },
                    {
                        component: "card",
                        data: { name: "License" },
                        enableClose: false,
                    },
                ],
            },
            {
                type: "tabset",
                data: { name: "Tools" },
                weight: 45,
                children: [
                    { component: "card", data: { name: "Search" } },
                    { component: "card", data: { name: "History" } },
                ],
            },
        ],
    },
    active: "documents",
};

/**
 * The command shortcuts, merged over `defaultKeyMap` (closeTab: Ctrl+Delete). Tabset cycling
 * and the tab/content toggle are off by default; this example turns them on. Pick modified
 * keys: single printable characters must be remappable (WCAG 2.1.4). The arrows, Home/End,
 * Enter and Space are the ARIA patterns' own keys and are not configurable.
 */
const keyMap: IKeyMap = {
    focusNextTabset: "Ctrl+Alt+ArrowRight",
    focusPreviousTabset: "Ctrl+Alt+ArrowLeft",
    focusTabToggle: "Ctrl+Enter",
};
const keys = resolveKeyMap(keyMap);

export default function Keyboard() {
    const [model] = useState(() => createModel<Types>(json));
    return (
        <Tooltip.Provider>
            <div className="flex min-h-0 flex-1 flex-col p-(--dk-gap)">
                <Dockable.Root
                    model={model}
                    // the shortcuts above, merged over the defaults
                    keyMap={keyMap}
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
                                // panels sit in a layer above the tabsets, whose overflow cannot
                                // clip them: the panel repeats the tabset's inner radius on its
                                // corners
                                className="palette-raised overflow-auto rounded-b-[max(0px,calc(var(--dk-radius)-var(--dk-border)))] bg-palette-base bg-(image:--dk-panel-texture) text-palette-contrast"
                            >
                                {tab.component === "keys" ? (
                                    <KeysPanel />
                                ) : (
                                    <Card name={tab.data.name} />
                                )}
                            </Dockable.Panel>
                        )}
                    </Dockable.Panels>
                    {/* Panels are portalled into the root after the indicator: it needs a
                        stacking order to paint above them. */}
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
        </Tooltip.Provider>
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

/** A tabset: a card with the strip of tabs on top and the measured content area below. */
function TabSet({ node }: { node: TabsetNode<Types> }) {
    return (
        <Dockable.TabSet
            node={node}
            className="palette-raised rounded-(--dk-radius) border-(length:--dk-border) border-palette-line bg-palette-base text-palette-contrast shadow-(--dk-shadow) data-active:border-(--dk-tabset-active-line)"
        >
            <div className="flex min-h-(--dk-tab-height) items-stretch border-b border-palette-line">
                <Dockable.TabList<Types>
                    // the tabset's name, from its data (a tabset made by a drop has none)
                    aria-label={node.data?.name || "Tabs"}
                    // the start padding is load-bearing: a tab flush with the tabset's edge could
                    // not take a drop before it (that edge is the tabset's side drop)
                    className="flex min-w-0 flex-1 items-end gap-(--dk-tab-gap) overflow-hidden bg-(--dk-strip-bg) ps-[max(0.25rem,var(--dk-strip-padding))] pt-[calc(var(--dk-strip-padding)/2)]"
                >
                    {(tab) => <KeyboardTab tab={tab} />}
                </Dockable.TabList>
            </div>
            <Dockable.TabSetContent />
        </Dockable.TabSet>
    );
}

/**
 * Each tab is a Tooltip trigger. `Tooltip.Trigger render={…}` merges its props (hover and focus
 * handlers, `aria-describedby`, the ref) into the tab, so the tooltip opens when the tab gets
 * keyboard focus too. It lists the tab's `aria-keyshortcuts`: the package advertises the same
 * bindings it handles, so what the tooltip reads is what the keyboard does.
 */
function KeyboardTab({ tab }: { tab: TabOf<Types> }) {
    const { model } = useDockable<Types>();
    // the same two bindings `Dockable.Tab` puts in its aria-keyshortcuts; the model says
    // whether the tab may close (a dry run of `tab.close`)
    const closeable = model.can("tab.close", { tab: tab.id });
    const shortcuts = [
        { name: "Enter or leave the content", spec: keys.focusTabToggle },
        { name: "Close", spec: closeable ? keys.closeTab : undefined },
    ].filter((item) => item.spec !== undefined);
    return (
        <Tooltip.Root>
            <Tooltip.Trigger
                render={
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
                        <span className="truncate">{tab.data.name}</span>
                        {/* the active tabset's marker: `in-data-active:` reads the enclosing
                            TabSet's data-active, `group-data-selected/tab:` this tab's */}
                        <span
                            aria-hidden="true"
                            className="palette-blue pointer-events-none absolute inset-x-2 bottom-0 hidden h-0.5 rounded-full bg-palette-base in-data-active:group-data-selected/tab:[display:var(--dk-tab-marker)]"
                        />
                    </Dockable.Tab>
                }
            />
            <Tooltip.Content>
                <div data-testid="tab-shortcuts" className="grid gap-1 text-xs">
                    {shortcuts.map((item) => (
                        <div
                            key={item.name}
                            className="flex items-center justify-between gap-3"
                        >
                            <span>{item.name}</span>
                            <code className="font-mono">
                                {toAriaKeyShortcuts(item.spec)}
                            </code>
                        </div>
                    ))}
                </div>
            </Tooltip.Content>
        </Tooltip.Root>
    );
}

/** `"Control+Alt+ArrowRight"` → `["Control", "Alt", "ArrowRight"]`, for `<kbd>` rendering. */
function Keys({ spec }: { spec: string | undefined }) {
    const aria = toAriaKeyShortcuts(spec);
    if (!aria) return null;
    return (
        <span className="inline-flex gap-0.5">
            {aria.split("+").map((key) => (
                <kbd
                    key={key}
                    className="rounded border border-palette-line bg-palette-soft px-1 font-mono text-xs"
                >
                    {key}
                </kbd>
            ))}
        </span>
    );
}

const LEGEND: { keys: string[]; does: string }[] = [
    { keys: ["Tab"], does: "Between the tab strips and the splitters" },
    {
        keys: ["ArrowLeft", "ArrowRight"],
        does: "Previous or next tab in the strip",
    },
    { keys: ["Home", "End"], does: "First or last tab" },
    {
        keys: ["Enter", "Space"],
        does: "Select the focused tab; on the selected one, enter its content",
    },
    {
        keys: ["ArrowLeft", "ArrowRight"],
        does: "On a focused splitter: resize",
    },
];

/** A panel listing every key, fixed and configured. */
function KeysPanel() {
    return (
        <PanelBody title="Keyboard">
            <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-2 text-sm">
                {LEGEND.map((row) => (
                    <div key={row.does} className="contents">
                        <dt className="flex gap-1">
                            {row.keys.map((key) => (
                                <Keys key={key} spec={key} />
                            ))}
                        </dt>
                        <dd className="m-0 text-palette-accent/85">
                            {row.does}
                        </dd>
                    </div>
                ))}
                <dt>
                    <Keys spec={keys.focusNextTabset} />
                </dt>
                <dd className="m-0 text-palette-accent/85">
                    Next tabset, from anywhere in the layout
                </dd>
                <dt>
                    <Keys spec={keys.focusPreviousTabset} />
                </dt>
                <dd className="m-0 text-palette-accent/85">Previous tabset</dd>
                <dt>
                    <Keys spec={keys.focusTabToggle} />
                </dt>
                <dd className="m-0 text-palette-accent/85">
                    Between a tab and its content
                </dd>
                <dt>
                    <Keys spec={keys.closeTab} />
                </dt>
                <dd className="m-0 text-palette-accent/85">
                    Close the focused tab
                </dd>
            </dl>
        </PanelBody>
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

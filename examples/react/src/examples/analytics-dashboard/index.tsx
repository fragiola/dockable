"use client";

import {
    createModel,
    type RowNode,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable";
import { Dockable, type RowSplitterProps } from "@fragiola/dockable-react";
import { type KeyboardEvent, useState, useSyncExternalStore } from "react";
import { cn } from "#/lib/cn";
import { UndoManager } from "../_kit/undo";
import { DEFAULT_FILTERS, type Filters, layout, type Types } from "./data";
import { Header } from "./header";
import { isAlert, TabContent, TabSetButtons } from "./tabs";
import {
    ChartWidget,
    FiltersContext,
    KpiWidget,
    OrdersWidget,
} from "./widgets";

// A sales dashboard. The header (filters, "Add widget", undo/redo) lives outside the layout;
// each tab's `component` picks its widget; a KPI below target turns its tab red; any tabset
// can be maximized, and any widget popped out to a second screen with its state intact.

/** The popout host page, served next to the app under its base (Vite's `BASE_URL`). */
const popoutURL = `${import.meta.env.BASE_URL}popout.html`;

export default function AnalyticsDashboard() {
    // The UndoManager records a step per command (`model.subscribe`); undo and redo load the saved
    // JSON back into the same model (`layout.load`), which keeps every panel's content mounted.
    // A KPI writing its status (`tab.update`) is not a layout change, so it records no undo step.
    const [{ model, undo }] = useState(() => {
        const model = createModel<Types>(layout);
        const undo = new UndoManager(model, {
            ignoreCommands: [
                "tabset.activate",
                "window.configure",
                "tab.update",
            ],
        });
        return { model, undo };
    });
    const history = useSyncExternalStore(
        undo.subscribe,
        undo.getSnapshot,
        undo.getSnapshot,
    );
    const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

    // Ctrl/Cmd+Z and Shift+Ctrl/Cmd+Z while focus is in the example, except in a text field
    // (where the browser's own undo belongs)
    const onKeyDown = (event: KeyboardEvent) => {
        const inField = (event.target as HTMLElement).closest(
            "input, textarea",
        );
        if (
            inField ||
            !(event.ctrlKey || event.metaKey) ||
            event.key.toLowerCase() !== "z"
        ) {
            return;
        }
        event.preventDefault();
        if (event.shiftKey) undo.redo();
        else undo.undo();
    };

    return (
        <FiltersContext.Provider value={filters}>
            {/* biome-ignore lint/a11y/noStaticElementInteractions: shortcuts for the whole example */}
            <div
                onKeyDown={onKeyDown}
                className="flex min-h-0 flex-1 flex-col font-(family-name:--dk-font)"
            >
                <Header
                    filters={filters}
                    onFilters={setFilters}
                    model={model}
                    undo={undo}
                    history={history}
                />
                <div className="flex min-h-0 flex-1 flex-col p-(--dk-gap)">
                    <Dockable.Root
                        model={model}
                        popoutURL={popoutURL}
                        // copies <html> and <body>'s attributes (light/dark, the example theme)
                        // into each popout window, kept in sync
                        popoutMirrorRoot
                        className="palette-surface min-h-0 flex-1 bg-palette-base font-(family-name:--dk-font) text-palette-contrast"
                    >
                        <Dockable.Row<Types>
                            renderSplitter={(props) => <Splitter {...props} />}
                        >
                            {renderNode}
                        </Dockable.Row>
                        {/* Every widget, positioned by the engine over its tabset (or over the
                            popout window's tabset: the panel moves there, its state intact). */}
                        <Dockable.Panels<Types>>
                            {(tab) => (
                                <Dockable.Panel
                                    node={tab}
                                    // panels sit in a layer above the tabsets, whose overflow
                                    // cannot clip them: the panel repeats the tabset's inner
                                    // radius on its corners
                                    className="palette-raised overflow-auto rounded-b-[max(0px,calc(var(--dk-radius)-var(--dk-border)))] bg-palette-base bg-(image:--dk-panel-texture) text-palette-contrast"
                                >
                                    {renderContent(tab)}
                                </Dockable.Panel>
                            )}
                        </Dockable.Panels>
                        <DropIndicator />
                        {/* A popped-out widget's window: its own row, with the same tabsets. */}
                        <Dockable.Popout<Types> className="palette-surface min-h-0 flex-1 bg-palette-base font-(family-name:--dk-font) text-palette-contrast">
                            {() => (
                                <>
                                    <Dockable.Row<Types>
                                        renderSplitter={(props) => (
                                            <Splitter {...props} />
                                        )}
                                    >
                                        {renderNode}
                                    </Dockable.Row>
                                    {/* a window shows its own outline during a drag into it */}
                                    <DropIndicator />
                                </>
                            )}
                        </Dockable.Popout>
                    </Dockable.Root>
                </div>
            </div>
        </FiltersContext.Provider>
    );
}

function renderContent(tab: TabOf<Types>) {
    // `tab.data` narrows on `tab.component`: each widget gets its own data type
    switch (tab.component) {
        case "chart":
            return <ChartWidget tab={tab} />;
        case "kpi":
            return <KpiWidget tab={tab} />;
        case "table":
            return <OrdersWidget />;
    }
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

/**
 * A tabset: a card with the strip of tabs on top (each with its widget's icon and a close button)
 * and maximize / pop out / dock back buttons at its end, then the measured content area.
 */
function TabSet({ node }: { node: TabsetNode<Types> }) {
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
                        <Dockable.Tab
                            node={tab}
                            className={cn(
                                "group/tab relative flex h-(--dk-tab-height) max-w-60 shrink-0 cursor-pointer select-none items-center gap-1.5 px-3",
                                "rounded-t-(--dk-tab-radius) font-(family-name:--dk-tab-font) text-(length:--dk-tab-size)",
                                "border-e-(length:--dk-tab-divider) border-palette-line outline-none transition-colors duration-(--dk-motion) hover:bg-palette-soft",
                                "focus-visible:ring-2 focus-visible:ring-palette-ring focus-visible:ring-inset",
                                "data-selected:bg-(--dk-tab-selected-bg) data-dragging:opacity-40",
                                // a KPI tab below target takes the danger palette
                                isAlert(tab)
                                    ? "palette-danger text-palette-accent data-selected:text-palette-accent"
                                    : "text-palette-accent/85 data-selected:text-(--dk-tab-selected-fg)",
                            )}
                        >
                            <TabContent tab={tab} />
                            {/* the active tabset's marker: `in-data-active:` reads the enclosing
                                TabSet's data-active, `group-data-selected/tab:` this tab's */}
                            <span
                                aria-hidden="true"
                                className="palette-blue pointer-events-none absolute inset-x-2 bottom-0 hidden h-0.5 rounded-full bg-palette-base in-data-active:group-data-selected/tab:[display:var(--dk-tab-marker)]"
                            />
                        </Dockable.Tab>
                    )}
                </Dockable.TabList>
                <div className="flex items-center gap-0.5 pe-1">
                    <TabSetButtons tabset={node} />
                </div>
            </div>
            <Dockable.TabSetContent />
        </Dockable.TabSet>
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

/**
 * Where a dragged tab would land. Panels are portalled into the root after it, so it needs a
 * stacking order to paint above them.
 */
function DropIndicator() {
    return (
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
    );
}

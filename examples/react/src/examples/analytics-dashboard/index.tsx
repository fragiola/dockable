"use client";

import {
    createModel,
    type RowNode,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable";
import { Dockable, type RowSplitterProps } from "@fragiola/dockable-react";
import { useState, useSyncExternalStore } from "react";
import { handleUndoKeys, UndoManager } from "../_kit/undo";
import { DEFAULT_FILTERS, type Filters, layout, type Types } from "./data";
import { Header } from "./header";
import * as styles from "./styles";
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
    // A KPI writing its status (`tab.set-data`) is not a layout change, so it records no undo step.
    const [{ model, undo }] = useState(() => {
        const model = createModel<Types>(layout);
        const undo = new UndoManager(model, {
            ignoreCommands: [
                "tabset.activate",
                "window.configure",
                "tab.set-data",
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

    return (
        <FiltersContext.Provider value={filters}>
            {/* the undo shortcuts while focus is in the example */}
            {/* biome-ignore lint/a11y/noStaticElementInteractions: shortcuts for the whole example */}
            <div
                onKeyDown={(event) => handleUndoKeys(undo, event)}
                className={styles.frame}
            >
                <Header
                    filters={filters}
                    onFilters={setFilters}
                    model={model}
                    undo={undo}
                    history={history}
                />
                <div className={styles.stage}>
                    <Dockable.Root
                        model={model}
                        popoutURL={popoutURL}
                        // copies <html> and <body>'s attributes (light/dark, the example theme)
                        // into each popout window, kept in sync
                        popoutMirrorRoot
                        className={styles.root}
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
                                    className={styles.panel}
                                >
                                    {renderContent(tab)}
                                </Dockable.Panel>
                            )}
                        </Dockable.Panels>
                        <Dockable.DropIndicator
                            className={styles.dropIndicator}
                        />
                        {/* A popped-out widget's window: its own row, with the same tabsets. */}
                        <Dockable.Popout<Types> className={styles.popout}>
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
                                    <Dockable.DropIndicator
                                        className={styles.dropIndicator}
                                    />
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
        <Dockable.TabSet node={node} className={styles.tabset}>
            <div className={styles.strip}>
                <Dockable.TabList<Types>
                    aria-label="Tabs"
                    className={styles.tabList}
                >
                    {(tab) => (
                        <Dockable.Tab
                            node={tab}
                            className={styles.tab(isAlert(tab))}
                        >
                            <TabContent tab={tab} />
                            {/* the active tabset's marker */}
                            <span
                                aria-hidden="true"
                                className={styles.tabMarker}
                            />
                        </Dockable.Tab>
                    )}
                </Dockable.TabList>
                <div className={styles.toolbar}>
                    <TabSetButtons tabset={node} />
                </div>
            </div>
            <Dockable.TabSetContent />
        </Dockable.TabSet>
    );
}

/** The bar between two children of a row, with a grip for the themes that show one. */
function Splitter(props: RowSplitterProps<Types>) {
    return (
        <Dockable.Splitter
            {...props}
            aria-label="Resize"
            className={styles.splitter}
        >
            <span aria-hidden="true" className={styles.splitterGrip} />
        </Dockable.Splitter>
    );
}

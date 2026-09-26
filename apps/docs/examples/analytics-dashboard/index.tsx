"use client";

import {
    Actions,
    type LayoutEngine,
    Model,
    type TabNode,
} from "@fragiola/dockable";
import { type KeyboardEvent, useState, useSyncExternalStore } from "react";
import { EngineBridge } from "../_kit/engine-bridge";
import { DockLayout } from "../_kit/layout";
import { UndoManager } from "../_kit/undo";
import { DEFAULT_FILTERS, type Filters, layout } from "./data";
import { Header } from "./header";
import { TabContent, TabSetActions, tabClassName } from "./tabs";
import {
    ChartWidget,
    FiltersContext,
    KpiWidget,
    OrdersWidget,
} from "./widgets";

// A sales dashboard. The header (filters, "Add widget", undo/redo) lives outside the layout;
// each tab's `component` picks its widget; a KPI below target turns its tab red; any tabset
// can be maximized, and any widget popped out to a second screen with its state intact.

function renderContent(tab: TabNode) {
    switch (tab.getComponent()) {
        case "chart":
            return <ChartWidget tab={tab} />;
        case "kpi":
            return <KpiWidget tab={tab} />;
        case "table":
            return <OrdersWidget />;
        default:
            return null;
    }
}

export default function AnalyticsDashboard() {
    // The UndoManager owns the model: undo and redo swap it for a model rebuilt from the saved
    // JSON (`Model.fromJson(json, previous)`), which keeps every panel's content mounted.
    // A KPI writing its status is not a layout change, so it records no undo step.
    const [undo] = useState(
        () =>
            new UndoManager(Model.fromJson(layout), {
                ignoreActionTypes: [
                    Actions.SET_ACTIVE_TABSET,
                    Actions.UPDATE_NODE_ATTRIBUTES,
                ],
            }),
    );
    const history = useSyncExternalStore(
        undo.subscribe,
        undo.getSnapshot,
        undo.getSnapshot,
    );
    const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
    const [engine, setEngine] = useState<LayoutEngine | null>(null);
    const model = history.model;

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

    if (!model) return null;
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
                    engine={engine}
                    model={model}
                    undo={undo}
                    history={history}
                />
                <DockLayout
                    model={model}
                    renderContent={renderContent}
                    renderTab={(tab) => <TabContent tab={tab} />}
                    tabClassName={tabClassName}
                    renderActions={(tabset) => (
                        <TabSetActions tabset={tabset} />
                    )}
                >
                    <EngineBridge onEngine={setEngine} />
                </DockLayout>
            </div>
        </FiltersContext.Provider>
    );
}

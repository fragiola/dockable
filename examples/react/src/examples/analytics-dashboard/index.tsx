"use client";

import { createModel, type TabOf } from "@fragiola/dockable";
import { type KeyboardEvent, useState, useSyncExternalStore } from "react";
import { DockLayout } from "../_kit/layout";
import { UndoManager } from "../_kit/undo";
import { DEFAULT_FILTERS, type Filters, layout, type Types } from "./data";
import { Header } from "./header";
import { TabContent, TabSetButtons, tabClassName } from "./tabs";
import {
    ChartWidget,
    FiltersContext,
    KpiWidget,
    OrdersWidget,
} from "./widgets";

// A sales dashboard. The header (filters, "Add widget", undo/redo) lives outside the layout;
// each tab's `component` picks its widget; a KPI below target turns its tab red; any tabset
// can be maximized, and any widget popped out to a second screen with its state intact.

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
                <DockLayout
                    model={model}
                    renderContent={renderContent}
                    renderTab={(tab) => <TabContent tab={tab} />}
                    tabClassName={tabClassName}
                    renderActions={(tabset) => (
                        <TabSetButtons tabset={tabset} />
                    )}
                />
            </div>
        </FiltersContext.Provider>
    );
}

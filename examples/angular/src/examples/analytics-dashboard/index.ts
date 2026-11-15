import { Component, DestroyRef, inject, input, signal } from "@angular/core";
import {
    createModel,
    DOCKABLE,
    injectDockable,
    type TabsetNode,
} from "@fragiola/dockable-angular";
import { handleUndoKeys, UndoManager } from "../_kit/undo";
import { DEFAULT_FILTERS, type Filters, layout, type Types } from "./data";
import { Header } from "./header";
import * as styles from "./styles";
import { isAlert, TabContent, TabSetButtons } from "./tabs";
import { ChartWidget, FILTERS, KpiWidget, OrdersWidget } from "./widgets";

// A sales dashboard. The header (filters, "Add widget", undo/redo) lives outside the layout;
// each tab's `component` picks its widget; a KPI below target turns its tab red; any tabset
// can be maximized, and any widget popped out to a second screen with its state intact.

/** The popout host page, served next to the app under its base (Vite's `BASE_URL`). */
const popoutURL = `${import.meta.env.BASE_URL}popout.html`;

/**
 * A tabset: a card with the strip of tabs on top (each with its widget's icon and a close button)
 * and maximize / pop out / dock back buttons at its end, then the measured content area.
 */
@Component({
    selector: "example-analytics-tabset",
    imports: [DOCKABLE, TabContent, TabSetButtons],
    host: { class: "contents" },
    template: `
        <div [dockableTabSet]="node()" [class]="styles.tabset">
            <div [class]="styles.strip">
                <div dockableTabList aria-label="Tabs" [class]="styles.tabList">
                    <ng-template [dockableTabListItem]="model()" let-tab>
                        <div [dockableTab]="tab" [class]="styles.tab(isAlert(tab))">
                            <example-analytics-tab-content [tab]="tab" />
                        </div>
                    </ng-template>
                </div>
                <div [class]="styles.toolbar">
                    <example-analytics-tabset-buttons [tabset]="node()" />
                </div>
            </div>
            <div dockableTabSetContent></div>
        </div>
    `,
})
class TabSet {
    readonly node = input.required<TabsetNode<Types>>();
    protected readonly styles = styles;
    protected readonly isAlert = isAlert;
    protected readonly model = injectDockable<Types>().model;
}

@Component({
    selector: "example-analytics-dashboard",
    imports: [DOCKABLE, Header, TabSet, ChartWidget, KpiWidget, OrdersWidget],
    providers: [
        {
            provide: FILTERS,
            useFactory: () => inject(AnalyticsDashboard).filters,
        },
    ],
    host: { class: "contents" },
    template: `
        <!-- the undo shortcuts while focus is in the example -->
        <div (keydown)="onKeydown($event)" [class]="styles.frame">
            <example-analytics-header
                [filters]="filters()"
                (filtersChange)="filters.set($event)"
                [model]="model"
                [undo]="undo"
                [history]="history()"
            />
            <div [class]="styles.stage">
                <!-- popoutMirrorRoot copies <html> and <body>'s attributes (light/dark, the example
                     theme) into each popout window, kept in sync -->
                <div
                    [dockableRoot]="model"
                    [popoutURL]="popoutURL"
                    popoutMirrorRoot
                    [class]="styles.root"
                >
                    <div dockableRow>
                        <ng-template [dockableRowChild]="model" let-node>
                            @if (node.type === "row") {
                                <div [dockableRow]="node"></div>
                            } @else {
                                <example-analytics-tabset [node]="node" />
                            }
                        </ng-template>
                        <ng-template dockableRowSplitter let-node="node" let-index="index">
                            <div
                                [dockableSplitter]="node"
                                [index]="index"
                                aria-label="Resize"
                                [class]="styles.splitter"
                            >
                                <span aria-hidden="true" [class]="styles.splitterGrip"></span>
                            </div>
                        </ng-template>
                    </div>
                    <!-- Every widget, positioned by the engine over its tabset (or over the popout
                         window's tabset: the panel moves there, its state intact). -->
                    <ng-template [dockablePanels]="model" let-tab>
                        <div [dockablePanel]="tab" [class]="styles.panel">
                            @switch (tab.component) {
                                @case ("chart") {
                                    <example-analytics-chart-widget [tab]="tab" />
                                }
                                @case ("kpi") {
                                    <example-analytics-kpi-widget [tab]="tab" />
                                }
                                @case ("table") {
                                    <example-analytics-orders-widget />
                                }
                            }
                        </div>
                    </ng-template>
                    <div
                        dockableDropIndicator
                        #indicator="dockableDropIndicator"
                        [class]="styles.dropIndicator(indicator.state())"
                    ></div>
                    <!-- A popped-out widget's window: its own row, with the same tabsets. -->
                    <ng-template [dockablePopout]="model" let-layout>
                        <div [dockablePopoutLayout]="layout" [class]="styles.popout">
                            <div dockableRow>
                                <ng-template [dockableRowChild]="model" let-node>
                                    @if (node.type === "row") {
                                        <div [dockableRow]="node"></div>
                                    } @else {
                                        <example-analytics-tabset [node]="node" />
                                    }
                                </ng-template>
                                <ng-template dockableRowSplitter let-node="node" let-index="index">
                                    <div
                                        [dockableSplitter]="node"
                                        [index]="index"
                                        aria-label="Resize"
                                        [class]="styles.splitter"
                                    >
                                        <span aria-hidden="true" [class]="styles.splitterGrip"></span>
                                    </div>
                                </ng-template>
                            </div>
                            <div
                                dockableDropIndicator
                                #popoutIndicator="dockableDropIndicator"
                                [class]="styles.dropIndicator(popoutIndicator.state())"
                            ></div>
                        </div>
                    </ng-template>
                </div>
            </div>
        </div>
    `,
})
export default class AnalyticsDashboard {
    protected readonly styles = styles;
    protected readonly popoutURL = popoutURL;
    // The UndoManager records a step per command (`model.subscribe`); undo and redo load the saved
    // JSON back into the same model (`layout.load`), which keeps every panel's content.
    // A KPI writing its status (`tab.set-data`) is not a layout change, so it records no undo step.
    protected readonly model = createModel<Types>(layout);
    protected readonly undo = new UndoManager(this.model, {
        ignoreCommands: ["tabset.activate", "window.configure", "tab.set-data"],
    });
    protected readonly history = signal(this.undo.getSnapshot());
    readonly filters = signal<Filters>(DEFAULT_FILTERS);

    constructor() {
        const unsubscribe = this.undo.subscribe(() =>
            this.history.set(this.undo.getSnapshot()),
        );
        inject(DestroyRef).onDestroy(unsubscribe);
    }

    protected onKeydown(event: KeyboardEvent) {
        handleUndoKeys(this.undo, event);
    }
}

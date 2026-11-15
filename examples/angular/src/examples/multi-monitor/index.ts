import { Component, signal } from "@angular/core";
import {
    type BatchEntry,
    createModel,
    DOCKABLE,
    type LayoutJson,
} from "@fragiola/dockable-angular";
import { LucideUndo2 } from "@lucide/angular";
import { ChartPanel } from "../_kit/charts";
import { LogPanel, TablePanel } from "../_kit/data";
import * as styles from "./styles";
import { MonitorTabSet } from "./tabset";

// A control room: each tabset can go to its own window ("screen"), tabs can be dragged between
// the windows and the main layout, and "Bring everything back" docks every window's tabs into the
// main layout. `[dockablePopoutTrigger]` with target="tabset" does the sending; a batch of
// `window.close` commands the bringing back. `popoutMirrorRoot` mirrors the page's theme into
// each window.

export type Types = {
    tabs: {
        requests: undefined;
        latency: undefined;
        orders: undefined;
        refunds: undefined;
        events: undefined;
    };
    tabset: { name: string };
};

const json: LayoutJson<Types> = {
    version: 1,
    // every tab may go to a window (`tab.popout`, `tabset.popout`)
    defaults: { tab: { poppable: true } },
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                data: { name: "Traffic" },
                weight: 40,
                children: [
                    { component: "requests", label: "Requests" },
                    { component: "latency", label: "Latency" },
                ],
            },
            {
                type: "row",
                weight: 60,
                children: [
                    {
                        type: "tabset",
                        data: { name: "Orders" },
                        children: [
                            { component: "orders", label: "Orders" },
                            { component: "refunds", label: "Refunds" },
                        ],
                    },
                    {
                        type: "tabset",
                        data: { name: "Events" },
                        children: [{ component: "events", label: "Events" }],
                    },
                ],
            },
        ],
    },
};

@Component({
    selector: "example-multi-monitor",
    imports: [
        DOCKABLE,
        LucideUndo2,
        ChartPanel,
        TablePanel,
        LogPanel,
        MonitorTabSet,
    ],
    host: { class: "contents" },
    template: `
        <div [class]="styles.page">
            <div [class]="styles.toolbar">
                <p [class]="styles.hint">
                    Send a tabset to another screen with its monitor button, then drag panels
                    between the windows.
                </p>
                <button type="button" [class]="styles.button" (click)="bringBack()">
                    <svg lucideUndo2 aria-hidden="true" [class]="styles.buttonIcon"></svg>
                    Bring everything back
                </button>
                <span role="status" data-testid="status" [class]="styles.status">{{ status() }}</span>
            </div>
            <div [class]="styles.frame">
                <!-- popoutMirrorRoot copies <html> and <body>'s attributes (light/dark, the example
                     theme) into each popout window, and keeps them in sync -->
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
                                <example-multi-monitor-tabset [node]="node" />
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
                    <!-- Every tab's content, in the main layout or in a window: the engine moves a
                         panel's element into the window its tab is in. -->
                    <ng-template [dockablePanels]="model" let-tab>
                        <div [dockablePanel]="tab" [class]="styles.panel">
                            @switch (tab.component) {
                                @case ("requests") {
                                    <kit-chart-panel kind="area" [seed]="11" />
                                }
                                @case ("latency") {
                                    <kit-chart-panel kind="line" [seed]="23" />
                                }
                                @case ("events") {
                                    <kit-log-panel />
                                }
                                <!-- orders and refunds -->
                                @default {
                                    <kit-table-panel />
                                }
                            }
                        </div>
                    </ng-template>
                    <div
                        dockableDropIndicator
                        #indicator="dockableDropIndicator"
                        [class]="styles.dropIndicator(indicator.state())"
                    ></div>
                    <!-- Each window's layout: its own root element in the window's document, with
                         the same recursion as the main layout. -->
                    <ng-template [dockablePopout]="model" let-layout>
                        <div [dockablePopoutLayout]="layout" [class]="styles.popout">
                            <div dockableRow>
                                <ng-template [dockableRowChild]="model" let-node>
                                    @if (node.type === "row") {
                                        <div [dockableRow]="node"></div>
                                    } @else {
                                        <example-multi-monitor-tabset [node]="node" />
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
export default class MultiMonitor {
    protected readonly styles = styles;
    protected readonly model = createModel<Types>(json);
    // The popout host page, served next to the app under its base (Vite's `BASE_URL`).
    protected readonly popoutURL = `${import.meta.env.BASE_URL}popout.html`;
    protected readonly status = signal("");

    // every window closes, and its tabs dock back into the main layout: one batch, one step
    protected bringBack() {
        const model = this.model;
        const windows = model.get("windows");
        const panels = windows.flatMap((layout) =>
            model.get("tabs", { layoutId: layout.id }),
        );
        const commands = windows.map(
            (layout): BatchEntry<Types> => ({
                command: "window.close",
                payload: { windowId: layout.id },
            }),
        );
        if (commands.length > 0) {
            model.run("batch", { commands });
        }
        this.status.set(
            panels.length
                ? `Brought back ${panels.length} panel(s)`
                : "Nothing is on another screen",
        );
    }
}

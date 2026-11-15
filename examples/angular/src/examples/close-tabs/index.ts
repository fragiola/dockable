import { Component } from "@angular/core";
import {
    createModel,
    DOCKABLE,
    type LayoutJson,
} from "@fragiola/dockable-angular";
import { LucideInbox } from "@lucide/angular";
import { PanelBody } from "../_kit/card";
import { type ChartKind, ChartPanel, KpiPanel } from "../_kit/charts";
import { LogPanel, TablePanel } from "../_kit/data";
import { ClosableTab, CloseTabsetButton } from "./parts";
import * as styles from "./styles";

export type Types = {
    tabs: {
        chart: { kind: ChartKind; seed: number };
        kpi: { seed: number };
        doc: { text: string };
        table: undefined;
        log: undefined;
    };
};

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
                        component: "chart",
                        label: "Home",
                        data: { kind: "area", seed: 3 },
                        closable: false,
                    },
                    {
                        component: "chart",
                        label: "Report",
                        data: { kind: "bar", seed: 17 },
                    },
                    {
                        component: "doc",
                        label: "Draft",
                        data: {
                            text: "Q3 planning: ship the billing page, then the team settings. Close this tab when the plan is agreed.",
                        },
                    },
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
                        children: [{ component: "table", label: "Inbox" }],
                    },
                    {
                        type: "tabset",
                        children: [
                            { component: "log", label: "Logs" },
                            {
                                component: "kpi",
                                label: "Metrics",
                                data: { seed: 21 },
                            },
                        ],
                    },
                ],
            },
        ],
    },
};

@Component({
    selector: "example-close-tabs",
    imports: [
        DOCKABLE,
        LucideInbox,
        PanelBody,
        ChartPanel,
        KpiPanel,
        LogPanel,
        TablePanel,
        ClosableTab,
        CloseTabsetButton,
    ],
    host: { class: "contents" },
    template: `
        <div [class]="styles.frame">
            <div [dockableRoot]="model" [class]="styles.root">
                <div dockableRow>
                    <ng-template [dockableRowChild]="model" let-node>
                        @if (node.type === "row") {
                            <div [dockableRow]="node"></div>
                        } @else {
                            <div [dockableTabSet]="node" [class]="styles.tabset">
                                <div [class]="styles.strip">
                                    <div dockableTabList aria-label="Tabs" [class]="styles.tabList">
                                        <ng-template [dockableTabListItem]="model" let-tab>
                                            <div [dockableTab]="tab" exampleClosableTab [class]="styles.tab"></div>
                                        </ng-template>
                                    </div>
                                    <div [class]="styles.toolbar">
                                        <example-close-tabset-button [tabset]="node" />
                                    </div>
                                </div>
                                <!-- No panel covers an empty tabset's content area, so it can show a
                                     hint: the part's state ({ empty }) through exportAs. -->
                                <div dockableTabSetContent #content="dockableTabSetContent">
                                    @if (content.state().empty) {
                                        <div [class]="styles.emptyHint">
                                            <svg lucideInbox aria-hidden="true" [class]="styles.emptyIcon"></svg>
                                            <p>Nothing open. Drag a tab here.</p>
                                        </div>
                                    }
                                </div>
                            </div>
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
                <ng-template [dockablePanels]="model" let-tab>
                    <div [dockablePanel]="tab" [class]="styles.panel">
                        <!-- a tab's content: tab.data and the component narrow together -->
                        @switch (tab.component) {
                            @case ("chart") {
                                <kit-chart-panel [kind]="tab.data.kind" [seed]="tab.data.seed" [title]="tab.label" />
                            }
                            @case ("kpi") {
                                <kit-kpi-panel [label]="tab.label" [seed]="tab.data.seed" />
                            }
                            @case ("doc") {
                                <kit-panel-body [title]="tab.label">
                                    <p [class]="styles.panelText">{{ tab.data.text }}</p>
                                </kit-panel-body>
                            }
                            @case ("table") {
                                <kit-table-panel />
                            }
                            @case ("log") {
                                <kit-log-panel />
                            }
                        }
                    </div>
                </ng-template>
                <div
                    dockableDropIndicator
                    #indicator="dockableDropIndicator"
                    [class]="styles.dropIndicator(indicator.state())"
                ></div>
            </div>
        </div>
    `,
})
export default class CloseTabs {
    protected readonly styles = styles;
    protected readonly model = createModel<Types>(json);
}

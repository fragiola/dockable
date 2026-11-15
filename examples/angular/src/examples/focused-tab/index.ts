import { Component } from "@angular/core";
import {
    createModel,
    DOCKABLE,
    type LayoutJson,
} from "@fragiola/dockable-angular";
import { PanelBody } from "../_kit/card";
import { ChartPanel, KpiPanel } from "../_kit/charts";
import { LogPanel, TablePanel } from "../_kit/data";
import * as styles from "./styles";

type Types = {
    tabs: {
        doc: { text: string };
        chart: { seed: number };
        kpi: { seed: number };
        table: undefined;
        log: undefined;
    };
};

const json: LayoutJson<Types> = {
    version: 1,
    // the active tabset when the layout loads (the layout's, by id)
    active: "editors",
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                id: "editors",
                weight: 50,
                children: [
                    {
                        component: "doc",
                        label: "Editor",
                        data: {
                            text: "Revenue grew in every region this quarter, led by the new self-serve plan. The chart in Preview follows the figures as they are edited.",
                        },
                    },
                    {
                        component: "chart",
                        label: "Preview",
                        data: { seed: 5 },
                    },
                ],
            },
            {
                type: "row",
                weight: 50,
                children: [
                    {
                        type: "tabset",
                        children: [
                            {
                                component: "doc",
                                label: "Outline",
                                data: {
                                    text: "Summary · Revenue · Customers · Outlook",
                                },
                            },
                            { component: "table", label: "Search" },
                        ],
                    },
                    {
                        type: "tabset",
                        children: [
                            {
                                component: "kpi",
                                label: "Problems",
                                data: { seed: 13 },
                            },
                            { component: "log", label: "Output" },
                        ],
                    },
                ],
            },
        ],
    },
};

@Component({
    selector: "example-focused-tab",
    imports: [DOCKABLE, PanelBody, ChartPanel, KpiPanel, TablePanel, LogPanel],
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
                                            <div [dockableTab]="tab" [class]="styles.tab">
                                                <span [class]="styles.tabName">{{ tab.label }}</span>
                                            </div>
                                        </ng-template>
                                    </div>
                                </div>
                                <div dockableTabSetContent></div>
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
                        @switch (tab.component) {
                            @case ("doc") {
                                <kit-panel-body [title]="tab.label">
                                    <p [class]="styles.panelText">{{ tab.data.text }}</p>
                                </kit-panel-body>
                            }
                            @case ("chart") {
                                <kit-chart-panel kind="line" [seed]="tab.data.seed" [title]="tab.label" />
                            }
                            @case ("kpi") {
                                <kit-kpi-panel [label]="tab.label" [seed]="tab.data.seed" />
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
export default class FocusedTab {
    protected readonly styles = styles;
    protected readonly model = createModel<Types>(json);
}

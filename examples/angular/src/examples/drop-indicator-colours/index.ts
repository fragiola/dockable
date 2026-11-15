import { Component } from "@angular/core";
import {
    createModel,
    DOCKABLE,
    type LayoutJson,
} from "@fragiola/dockable-angular";
import { type ChartKind, ChartPanel, KpiPanel } from "../_kit/charts";
import * as styles from "./styles";

// The drop indicator is the app's to draw, from data. Here its colour says where a dragged tab
// would land, in two parts:
//
//   which region  each tabset has a colour family: Inbox green, Review orange, Archive purple,
//                 Trash red (a tabset made by a split is rose); the layout's edge is blue
//   which side    a drop into the tabset fills the outline, a drop beside it (an edge of the
//                 tabset) thickens the side it docks to, a drop at the layout's edge is striped
//
// Both are in the indicator's state, which its class reads: the targeted tabset
// (`targetTabsetId`), the side (`location`) and the kind of drop (`kind`).

type Types = {
    tabs: {
        chart: { kind: ChartKind };
        kpi: { seed: number };
    };
};

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "row",
                weight: 50,
                children: [
                    {
                        type: "tabset",
                        id: "inbox",
                        children: [
                            {
                                component: "kpi",
                                label: "Signups",
                                data: { seed: 5 },
                            },
                            {
                                component: "chart",
                                label: "Leads",
                                data: { kind: "line" },
                            },
                        ],
                    },
                    {
                        type: "tabset",
                        id: "review",
                        children: [
                            {
                                component: "chart",
                                label: "Pipeline",
                                data: { kind: "bar" },
                            },
                        ],
                    },
                ],
            },
            {
                type: "row",
                weight: 50,
                children: [
                    {
                        type: "tabset",
                        id: "archive",
                        children: [
                            {
                                component: "chart",
                                label: "Q1 share",
                                data: { kind: "donut" },
                            },
                        ],
                    },
                    {
                        type: "tabset",
                        id: "trash",
                        children: [
                            {
                                component: "kpi",
                                label: "Churn",
                                data: { seed: 14 },
                            },
                        ],
                    },
                ],
            },
        ],
    },
};

/** The legend: what each colour and each pattern means. */
const REGIONS: { region: styles.Region; label: string }[] = [
    { region: "inbox", label: "Inbox" },
    { region: "review", label: "Review" },
    { region: "archive", label: "Archive" },
    { region: "trash", label: "Trash" },
    { region: "edge", label: "Layout edge" },
];

@Component({
    selector: "example-drop-indicator-colours",
    imports: [DOCKABLE, ChartPanel, KpiPanel],
    host: { class: "contents" },
    template: `
        <div [class]="styles.legend">
            <ul aria-label="Regions" [class]="styles.legendList">
                @for (item of REGIONS; track item.region) {
                    <li [class]="styles.legendItem">
                        <span aria-hidden="true" [class]="styles.swatch(item.region)"></span>
                        {{ item.label }}
                    </li>
                }
            </ul>
            <p [class]="styles.legendHint">
                Filled: into the tabset. Thick side: beside it. Stripes: at the layout's edge.
            </p>
        </div>
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
                        ></div>
                    </ng-template>
                </div>
                <ng-template [dockablePanels]="model" let-tab>
                    <div [dockablePanel]="tab" [class]="styles.panel">
                        @switch (tab.component) {
                            @case ("chart") {
                                <kit-chart-panel
                                    [kind]="tab.data.kind"
                                    [seed]="tab.label.length"
                                    [title]="tab.label"
                                />
                            }
                            @case ("kpi") {
                                <kit-kpi-panel [label]="tab.label" [seed]="tab.data.seed" />
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
export default class DropIndicatorColours {
    protected readonly styles = styles;
    protected readonly REGIONS = REGIONS;
    protected readonly model = createModel<Types>(json);
}

import { Component } from "@angular/core";
import {
    createModel,
    DOCKABLE,
    type LayoutJson,
} from "@fragiola/dockable-angular";
import { PanelBody } from "../_kit/card";
import { type ChartKind, ChartPanel, KpiPanel } from "../_kit/charts";
import { TablePanel } from "../_kit/data";
import { PinButton, TabLabel } from "./parts";
import * as styles from "./styles";

// Pinned tabs: kept at the start of the strip by the model, shown as icons, and not closable
// (`model.can("tab.close", …)` refuses a pinned tab). The styles read `data-pinned` on the tab.

// Every component carries the icon its tab shows when pinned.
type TabData = { icon?: string };
export type Types = {
    tabs: {
        chart: TabData & { kind: ChartKind; seed: number };
        kpi: TabData & { seed: number; unit?: string };
        table: TabData;
        doc: TabData & { text: string };
    };
};

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 60,
                children: [
                    {
                        component: "chart",
                        label: "Home",
                        pinned: true,
                        data: {
                            icon: "home",
                            kind: "area",
                            seed: 4,
                        },
                    },
                    {
                        component: "table",
                        label: "Mail",
                        pinned: true,
                        data: { icon: "mail" },
                    },
                    {
                        component: "chart",
                        label: "Calendar",
                        data: {
                            icon: "calendar",
                            kind: "bar",
                            seed: 12,
                        },
                    },
                    {
                        component: "chart",
                        label: "Report.pdf",
                        data: { kind: "donut", seed: 8 },
                    },
                    {
                        component: "kpi",
                        label: "Budget.xlsx",
                        data: { seed: 15, unit: "$" },
                    },
                ],
            },
            {
                type: "tabset",
                weight: 40,
                children: [
                    {
                        component: "doc",
                        label: "Notes",
                        data: {
                            text: "Pin or unpin the selected tab with the pin button in the header.",
                        },
                    },
                    {
                        component: "doc",
                        label: "Drafts",
                        data: {
                            text: "A pinned tab moves to the start of the strip and loses its close button.",
                        },
                    },
                ],
            },
        ],
    },
};

@Component({
    selector: "example-pinned-tabs",
    imports: [
        DOCKABLE,
        PanelBody,
        ChartPanel,
        KpiPanel,
        TablePanel,
        TabLabel,
        PinButton,
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
                            <!-- A tabset: the strip of tabs and the pin button on top, the measured
                                 content area below. -->
                            <div [dockableTabSet]="node" [class]="styles.tabset">
                                <div [class]="styles.strip">
                                    <div dockableTabList aria-label="Tabs" [class]="styles.tabList">
                                        <ng-template [dockableTabListItem]="model" let-tab>
                                            <div [dockableTab]="tab" exampleTabLabel [class]="styles.tab"></div>
                                        </ng-template>
                                    </div>
                                    <div [class]="styles.toolbar">
                                        <example-pin-button [tabset]="node" />
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
                            @case ("chart") {
                                <kit-chart-panel [kind]="tab.data.kind" [seed]="tab.data.seed" [title]="tab.label" />
                            }
                            @case ("kpi") {
                                <kit-kpi-panel [label]="tab.label" [seed]="tab.data.seed" [unit]="tab.data.unit ?? ''" />
                            }
                            @case ("table") {
                                <kit-table-panel />
                            }
                            @case ("doc") {
                                <kit-panel-body [title]="tab.label">
                                    <p [class]="styles.panelText">{{ tab.data.text }}</p>
                                </kit-panel-body>
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
export default class PinnedTabs {
    protected readonly styles = styles;
    protected readonly model = createModel<Types>(json);
}

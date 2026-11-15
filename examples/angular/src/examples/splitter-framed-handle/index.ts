import { Component } from "@angular/core";
import {
    createModel,
    DOCKABLE,
    type LayoutJson,
} from "@fragiola/dockable-angular";
import { type ChartKind, ChartPanel, KpiPanel } from "../_kit/charts";
import * as styles from "./styles";

// A thin line with a framed handle on it: a pill with a border, a shadow and two grip lines,
// centred on the splitter. The splitter itself stays 8px thick (the engine measures the element,
// not its children), so the pill is wider than the bar and overflows it on both sides; the line is
// the bar's `::before`. Hover, `data-dragging` and keyboard focus restyle the pill, read from the
// splitter through `group-…/splitter:` classes.

type Types = {
    tabs: {
        chart: { kind: ChartKind };
        kpi: { seed: number };
    };
};

// One column beside a row of two: the splitters run both ways.
const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 35,
                children: [
                    { component: "kpi", label: "Revenue", data: { seed: 3 } },
                    { component: "kpi", label: "Orders", data: { seed: 9 } },
                ],
            },
            {
                type: "row",
                weight: 65,
                children: [
                    {
                        type: "tabset",
                        weight: 60,
                        children: [
                            {
                                component: "chart",
                                label: "Traffic",
                                data: { kind: "area" },
                            },
                        ],
                    },
                    {
                        type: "tabset",
                        weight: 40,
                        children: [
                            {
                                component: "chart",
                                label: "Channels",
                                data: { kind: "bar" },
                            },
                            {
                                component: "chart",
                                label: "Share",
                                data: { kind: "pie" },
                            },
                        ],
                    },
                ],
            },
        ],
    },
};

@Component({
    selector: "example-splitter-framed-handle",
    imports: [DOCKABLE, ChartPanel, KpiPanel],
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
                    <!-- The bar between two children of a row: a 1px line with a framed handle in the
                         middle. \`data-orientation\` is the ARIA one: "vertical" is a bar between
                         side-by-side panes. -->
                    <ng-template dockableRowSplitter let-node="node" let-index="index">
                        <div
                            [dockableSplitter]="node"
                            [index]="index"
                            aria-label="Resize"
                            [class]="styles.splitter"
                        >
                            <span aria-hidden="true" [class]="styles.handle">
                                <span [class]="styles.handleLine"></span>
                                <span [class]="styles.handleLine"></span>
                            </span>
                        </div>
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
export default class SplitterFramedHandle {
    protected readonly styles = styles;
    protected readonly model = createModel<Types>(json);
}

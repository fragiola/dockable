import { Component, computed } from "@angular/core";
import {
    createModel,
    DOCKABLE,
    injectModelState,
    type LayoutJson,
    type Model,
    type TabNode,
} from "@fragiola/dockable-angular";
import {
    LucideChartArea,
    LucideChartColumn,
    LucideChartLine,
    LucideChartPie,
    LucideDonut,
    LucideDynamicIcon,
    type LucideIcon,
    LucideShuffle,
} from "@lucide/angular";
import { type ChartKind, ChartPanel } from "../_kit/charts";
import { TablePanel } from "../_kit/data";
import * as styles from "./styles";

// A toolbar outside the layout acts on the tab the user is looking at: the selected tab of the
// active tabset. Click another tabset and the toolbar follows it. What it changes (the chart's
// kind, its data) is the tab's typed data, patched with `tab.set-data`: the chart re-renders from
// it, and it would be saved with the layout. A table tab has nothing to drive: the toolbar says so.

type ChartData = { kind: ChartKind; seed: number };

type Types = {
    tabs: {
        chart: ChartData;
        table: undefined;
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
                    {
                        component: "chart",
                        label: "Revenue",
                        data: { kind: "bar", seed: 3 },
                    },
                    { component: "table", label: "Orders" },
                ],
            },
            {
                type: "tabset",
                weight: 45,
                children: [
                    {
                        component: "chart",
                        label: "Share",
                        data: { kind: "donut", seed: 5 },
                    },
                    {
                        component: "chart",
                        label: "Traffic",
                        data: { kind: "line", seed: 9 },
                    },
                ],
            },
        ],
    },
};

const KINDS: { kind: ChartKind; label: string; icon: LucideIcon }[] = [
    { kind: "line", label: "Line", icon: LucideChartLine },
    { kind: "area", label: "Area", icon: LucideChartArea },
    { kind: "bar", label: "Bar", icon: LucideChartColumn },
    { kind: "pie", label: "Pie", icon: LucideChartPie },
    { kind: "donut", label: "Donut", icon: LucideDonut },
];

/** The tab the user is looking at: the selected tab of the active tabset (else the first). */
function currentTab(model: Model<Types>) {
    const tabset = model.get("default-tabset");
    return tabset
        ? model.get("selected-tab-by", { tabsetId: tabset.id })
        : undefined;
}

/** Changes some keys of a chart tab's data (`tab.set-data` keeps the others). */
function updateChart(
    model: Model<Types>,
    tab: TabNode<"chart", ChartData>,
    change: Partial<ChartData>,
) {
    model.run("tab.set-data", { tabId: tab.id, data: change });
}

@Component({
    selector: "example-active-tab-controls",
    imports: [
        DOCKABLE,
        LucideDynamicIcon,
        LucideShuffle,
        ChartPanel,
        TablePanel,
    ],
    host: { class: "contents" },
    template: `
        <!-- The toolbar outside the layout: it follows the current tab, and a commit re-renders
             it, not the layout. -->
        <div [class]="styles.toolbar">
            <p role="status" data-testid="target" [class]="styles.target">{{ targetText() }}</p>
            <fieldset aria-label="Chart kind" [disabled]="!chart()" [class]="styles.segments">
                @for (item of KINDS; track item.kind) {
                    <button
                        type="button"
                        [attr.aria-label]="item.label"
                        [attr.aria-pressed]="chart()?.data?.kind === item.kind"
                        [class]="styles.segment"
                        (click)="setKind(item.kind)"
                    >
                        <svg [lucideIcon]="item.icon" aria-hidden="true" [class]="styles.icon"></svg>
                    </button>
                }
            </fieldset>
            <button type="button" [disabled]="!chart()" [class]="styles.button" (click)="newData()">
                <svg lucideShuffle aria-hidden="true" [class]="styles.icon"></svg>
                New data
            </button>
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
                                <!-- the chart follows the tab's data: its kind and its seed -->
                                <kit-chart-panel
                                    [kind]="tab.data.kind"
                                    [seed]="tab.data.seed"
                                    [title]="tab.label"
                                />
                            }
                            @case ("table") {
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
            </div>
        </div>
    `,
})
export default class ActiveTabControls {
    protected readonly styles = styles;
    protected readonly KINDS = KINDS;
    protected readonly model = createModel<Types>(json);
    // UI outside the layout reads the model through a selector: it changes when the tab does
    protected readonly tab = injectModelState(() => currentTab(this.model), {
        model: this.model,
    });
    protected readonly chart = computed(() => {
        const tab = this.tab();
        return tab?.component === "chart" ? tab : undefined;
    });
    protected readonly targetText = computed(() => {
        const chart = this.chart();
        return chart
            ? `Editing ${chart.label}`
            : `${this.tab()?.label ?? "No tab"}: not a chart`;
    });

    protected setKind(kind: ChartKind) {
        const chart = this.chart();
        if (chart) updateChart(this.model, chart, { kind });
    }

    protected newData() {
        const chart = this.chart();
        if (chart)
            updateChart(this.model, chart, { seed: chart.data.seed + 1 });
    }
}

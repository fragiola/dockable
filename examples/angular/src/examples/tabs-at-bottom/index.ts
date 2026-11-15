import { NgTemplateOutlet } from "@angular/common";
import { Component, computed, signal } from "@angular/core";
import {
    createModel,
    DOCKABLE,
    type LayoutJson,
} from "@fragiola/dockable-angular";
import { LucidePanelBottom, LucidePanelTop } from "@lucide/angular";
import { type ChartKind, ChartPanel, KpiPanel } from "../_kit/charts";
import { LogPanel, TablePanel } from "../_kit/data";
import * as styles from "./styles";

type Types = {
    tabs: {
        table: undefined;
        chart: { kind: ChartKind; seed: number };
        log: undefined;
        kpi: { seed: number };
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
                    { component: "table", label: "Sheet 1" },
                    {
                        component: "chart",
                        label: "Sheet 2",
                        data: { kind: "bar", seed: 5 },
                    },
                    {
                        component: "chart",
                        label: "Sheet 3",
                        data: { kind: "donut", seed: 12 },
                    },
                ],
            },
            {
                type: "tabset",
                weight: 40,
                children: [
                    { component: "log", label: "Console" },
                    { component: "kpi", label: "Watch", data: { seed: 21 } },
                ],
            },
        ],
    },
};

type Position = "top" | "bottom";

@Component({
    selector: "example-tabs-at-bottom",
    imports: [
        NgTemplateOutlet,
        DOCKABLE,
        LucidePanelTop,
        LucidePanelBottom,
        ChartPanel,
        KpiPanel,
        TablePanel,
        LogPanel,
    ],
    host: { class: "contents" },
    template: `
        <div [class]="styles.page">
            <div [class]="styles.toolbar">
                <span [class]="styles.toolbarLabel">Tabs</span>
                @for (value of POSITIONS; track value) {
                    <button
                        type="button"
                        [attr.aria-pressed]="position() === value"
                        [class]="styles.button"
                        (click)="position.set(value)"
                    >
                        @if (value === "top") {
                            <svg lucidePanelTop aria-hidden="true" [class]="styles.buttonIcon"></svg>
                        } @else {
                            <svg lucidePanelBottom aria-hidden="true" [class]="styles.buttonIcon"></svg>
                        }
                        {{ value === "top" ? "Top" : "Bottom" }}
                    </button>
                }
            </div>
            <div [class]="styles.frame">
                <div [dockableRoot]="model" [class]="styles.root">
                    <div dockableRow>
                        <ng-template [dockableRowChild]="model" let-node>
                            @if (node.type === "row") {
                                <div [dockableRow]="node"></div>
                            } @else {
                                <!-- A tabset is a flex column ([dockableTabSet] sets display: flex;
                                     flex-direction: column), and [dockableTabSetContent] takes the
                                     space left over. So the strip goes below the content just by
                                     coming after it in the markup: the engine measures the content
                                     area wherever it is and positions the panel over it. -->
                                <div [dockableTabSet]="node" [class]="styles.tabset">
                                    <ng-template #strip>
                                        <div [class]="styles.strip(bottom())">
                                            <div dockableTabList aria-label="Tabs" [class]="styles.tabList">
                                                <ng-template [dockableTabListItem]="model" let-tab>
                                                    <div [dockableTab]="tab" [class]="styles.tab(bottom())">
                                                        <span [class]="styles.tabName">{{ tab.label }}</span>
                                                    </div>
                                                </ng-template>
                                            </div>
                                        </div>
                                    </ng-template>
                                    @if (!bottom()) {
                                        <ng-container [ngTemplateOutlet]="strip" />
                                    }
                                    <div dockableTabSetContent></div>
                                    @if (bottom()) {
                                        <ng-container [ngTemplateOutlet]="strip" />
                                    }
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
                        <div [dockablePanel]="tab" [class]="styles.panel(bottom())">
                            @switch (tab.component) {
                                @case ("table") {
                                    <kit-table-panel />
                                }
                                @case ("chart") {
                                    <kit-chart-panel [kind]="tab.data.kind" [seed]="tab.data.seed" [title]="tab.label" />
                                }
                                @case ("log") {
                                    <kit-log-panel />
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
        </div>
    `,
})
export default class TabsAtBottom {
    protected readonly styles = styles;
    protected readonly POSITIONS = ["top", "bottom"] as const;
    protected readonly model = createModel<Types>(json);
    protected readonly position = signal<Position>("bottom");
    protected readonly bottom = computed(() => this.position() === "bottom");
}

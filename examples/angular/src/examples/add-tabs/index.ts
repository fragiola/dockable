import { Component, signal } from "@angular/core";
import {
    createModel,
    DOCKABLE,
    type LayoutJson,
    MAIN_LAYOUT,
} from "@fragiola/dockable-angular";
import {
    LucideChartLine,
    LucideDynamicIcon,
    LucideScrollText,
    LucideTable2,
} from "@lucide/angular";
import { SELECT_PARTS } from "#/components/ui/select";
import { ChartPanel } from "../_kit/charts";
import { LogPanel, TablePanel } from "../_kit/data";
import * as styles from "./styles";

type Types = {
    tabs: {
        chart: undefined;
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
                children: [
                    { component: "chart", label: "Revenue" },
                    { component: "table", label: "Orders" },
                ],
            },
        ],
    },
};

type Target = "active" | "end" | "bottom";

const TARGETS: { value: Target; label: string }[] = [
    { value: "active", label: "Active tabset" },
    { value: "end", label: "New tabset on the right" },
    { value: "bottom", label: "New tabset at the bottom" },
];

const KINDS = [
    { component: "chart", name: "Chart", icon: LucideChartLine },
    { component: "table", name: "Table", icon: LucideTable2 },
    { component: "log", name: "Log", icon: LucideScrollText },
] as const;

@Component({
    selector: "example-add-tabs",
    imports: [
        DOCKABLE,
        SELECT_PARTS,
        LucideDynamicIcon,
        ChartPanel,
        TablePanel,
        LogPanel,
    ],
    host: { class: "contents" },
    template: `
        <div [class]="styles.page">
            <div [class]="styles.toolbar">
                @for (kind of KINDS; track kind.component) {
                    <button type="button" [class]="styles.button" (click)="add(kind)">
                        <svg [lucideIcon]="kind.icon" aria-hidden="true" [class]="styles.buttonIcon"></svg>
                        {{ "New " + kind.name.toLowerCase() }}
                    </button>
                }
                <span [class]="styles.targetLabel">Add to</span>
                <button
                    [kitSelectTrigger]="targets"
                    [(value)]="target"
                    [items]="TARGETS"
                    aria-label="Where to add"
                    data-testid="target"
                    [class]="styles.targetSelect"
                >
                    <span kitSelectValue></span>
                </button>
                <ng-template #targets>
                    <div kitSelectContent>
                        @for (item of TARGETS; track item.value) {
                            <div [kitSelectItem]="item.value">{{ item.label }}</div>
                        }
                    </div>
                </ng-template>
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
                            >
                                <span aria-hidden="true" [class]="styles.splitterGrip"></span>
                            </div>
                        </ng-template>
                    </div>
                    <ng-template [dockablePanels]="model" let-tab>
                        <div [dockablePanel]="tab" [class]="styles.panel">
                            @switch (tab.component) {
                                @case ("chart") {
                                    <kit-chart-panel [seed]="tab.label.length * 7" />
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
        </div>
    `,
})
export default class AddTabs {
    protected readonly styles = styles;
    protected readonly KINDS = KINDS;
    protected readonly TARGETS = TARGETS;
    protected readonly model = createModel<Types>(json);
    protected readonly target = signal<Target>("active");
    private count = 0;

    // The toolbar is outside the layout: it runs commands on the model it owns, no engine needed.
    protected add(kind: (typeof KINDS)[number]) {
        this.count += 1;
        const tab = {
            component: kind.component,
            label: `${kind.name} ${this.count}`,
        };
        const target = this.target();
        if (target === "active") {
            // into the active tabset (else the first), at the end (-1), and selected; with no
            // tabset left, into the layout itself: a new tabset
            this.model.run("tab.add", {
                ...tab,
                to: this.model.get("default-tabset")?.id ?? MAIN_LAYOUT,
                location: "center",
                index: -1,
                select: true,
            });
        } else {
            // dropped on an edge of the layout (its root row): a new tabset along that edge
            this.model.run("tab.add", {
                ...tab,
                to: MAIN_LAYOUT,
                location: target,
                select: true,
            });
        }
    }
}

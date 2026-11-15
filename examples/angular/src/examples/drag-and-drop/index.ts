import { Component } from "@angular/core";
import {
    createModel,
    DOCKABLE,
    type DropLocation,
    type LayoutJson,
} from "@fragiola/dockable-angular";
import {
    LucideArrowDown,
    LucideArrowLeft,
    LucideArrowRight,
    LucideArrowUp,
    LucideDynamicIcon,
    type LucideIcon,
} from "@lucide/angular";
import { type ChartKind, ChartPanel, KpiPanel } from "../_kit/charts";
import { LogPanel, TablePanel } from "../_kit/data";
import * as styles from "./styles";

// Drag tabs between tabsets and to the layout's edges. The drop indicator is styled from its state:
// blue for a drop into a tabset (`kind: "rect"`), a dashed orange band for a drop at the layout's
// edge (`kind: "edge"`), an arrow for the side, and a transition as long as the root's
// `tabDragSpeed`. During a drag the edge indicators (`[dockableEdgeIndicator]`) mark the four bands
// where a drop docks to an edge.

type Types = {
    tabs: {
        chart: { kind: ChartKind; seed: number };
        kpi: { seed: number };
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
                weight: 50,
                children: [
                    {
                        component: "chart",
                        label: "Drag me",
                        data: { kind: "area", seed: 4 },
                    },
                    { component: "kpi", label: "Or me", data: { seed: 15 } },
                    {
                        component: "chart",
                        label: "Me too",
                        data: { kind: "donut", seed: 9 },
                    },
                ],
            },
            {
                type: "row",
                weight: 50,
                children: [
                    {
                        type: "tabset",
                        children: [{ component: "table", label: "Inbox" }],
                    },
                    {
                        type: "tabset",
                        children: [{ component: "log", label: "Outbox" }],
                    },
                ],
            },
        ],
    },
};

const ARROWS: Partial<Record<DropLocation, LucideIcon>> = {
    top: LucideArrowUp,
    bottom: LucideArrowDown,
    start: LucideArrowLeft,
    end: LucideArrowRight,
};

const EDGES = [
    ["top", LucideArrowUp],
    ["bottom", LucideArrowDown],
    ["start", LucideArrowLeft],
    ["end", LucideArrowRight],
] as const;

@Component({
    selector: "example-drag-and-drop",
    imports: [
        DOCKABLE,
        LucideDynamicIcon,
        ChartPanel,
        KpiPanel,
        TablePanel,
        LogPanel,
    ],
    host: { class: "contents" },
    template: `
        <div [class]="styles.frame">
            <!-- tabDragSpeed: how long the indicator may take to move to the next target (exposed
                 as data); while a tab of this layout is dragged, the panels fade back -->
            <div [dockableRoot]="model" [tabDragSpeed]="0.2" [class]="styles.root">
                <div dockableRow>
                    <ng-template [dockableRowChild]="model" let-node>
                        @if (node.type === "row") {
                            <div [dockableRow]="node"></div>
                        } @else {
                            <!-- A tabset. The one the drag would drop into (or beside) has
                                 data-drop-target (and data-drop-location), so it is styled from
                                 data alone: a layer above its panel outlines it. -->
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
                                <span aria-hidden="true" [class]="styles.dropTargetOutline"></span>
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
                                <kit-chart-panel
                                    [kind]="tab.data.kind"
                                    [seed]="tab.data.seed"
                                    [title]="tab.label"
                                />
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
                <!-- Where a dragged tab would land, animated at the layout's drag speed; its state
                     also gives an arrow for the side it docks to. -->
                <div
                    dockableDropIndicator
                    #indicator="dockableDropIndicator"
                    [style.transition-duration.s]="indicator.state().tabDragSpeed"
                    [class]="styles.dropIndicator(indicator.state())"
                >
                    @if (ARROWS[indicator.state().location]; as arrow) {
                        <svg [lucideIcon]="arrow" [class]="styles.dropArrow"></svg>
                    }
                </div>
                <!-- the edge docking targets, shown during a drag (solid under the pointer) -->
                @for (edge of EDGES; track edge[0]) {
                    <div
                        [dockableEdgeIndicator]="edge[0]"
                        [class]="styles.edgeIndicator"
                    >
                        <svg [lucideIcon]="edge[1]" aria-hidden="true" [class]="styles.edgeArrow"></svg>
                    </div>
                }
            </div>
        </div>
    `,
})
export default class DragAndDrop {
    protected readonly styles = styles;
    protected readonly ARROWS = ARROWS;
    protected readonly EDGES = EDGES;
    protected readonly model = createModel<Types>(json);
}

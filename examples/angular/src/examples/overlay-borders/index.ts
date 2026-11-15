import { Component } from "@angular/core";
import {
    createModel,
    DOCKABLE,
    type LayoutJson,
} from "@fragiola/dockable-angular";
import {
    LucideArrowDown,
    LucideArrowLeft,
    LucideArrowRight,
    LucideArrowUp,
    LucideDynamicIcon,
} from "@lucide/angular";
import { PanelBody } from "../_kit/card";
import { type ChartKind, ChartPanel, KpiPanel } from "../_kit/charts";
import { LogPanel, TablePanel } from "../_kit/data";
import * as styles from "./styles";
import { Toolbar } from "./toolbar";

// Overlay borders (`mode: "overlay"`) open over the layout instead of beside it, and close on a
// press elsewhere in the layout or on Escape (keyMap.closeOverlayBorder). The toolbar switches a
// border's mode with the `border.configure` command. The end border is empty and `autoHide`: it
// shows up while a tab is dragged near the layout's end edge, so it can take the drop. The edge
// indicators (`[dockableEdgeIndicator]`) mark where a drop docks to an edge instead.

export type Types = {
    tabs: {
        kpi: { seed: number };
        doc: { text: string };
        chart: { kind: ChartKind };
        table: undefined;
        log: undefined;
    };
};

const json: LayoutJson<Types> = {
    version: 1,
    defaults: { border: { size: 240 } },
    borders: [
        {
            location: "start",
            mode: "overlay",
            children: [
                { component: "kpi", label: "Inbox", data: { seed: 17 } },
                {
                    component: "doc",
                    label: "Drafts",
                    data: {
                        text: "Hi team, the release notes are attached. Let me know before Friday if anything is missing.",
                    },
                },
            ],
        },
        {
            location: "bottom",
            mode: "overlay",
            size: 180,
            children: [{ component: "log", label: "Console" }],
        },
        {
            location: "end",
            autoHide: true,
            children: [],
        },
    ],
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 60,
                children: [
                    {
                        component: "doc",
                        label: "Message",
                        data: {
                            text: "The left and bottom borders open over this layout without resizing it. Press elsewhere in the layout, or Escape, to close them.",
                        },
                    },
                    {
                        component: "chart",
                        label: "Calendar",
                        data: { kind: "bar" },
                    },
                ],
            },
            {
                type: "tabset",
                weight: 40,
                children: [{ component: "table", label: "Contacts" }],
            },
        ],
    },
};

// the four edge docking targets, each with an arrow pointing at its edge
const EDGES = [
    ["top", LucideArrowUp],
    ["bottom", LucideArrowDown],
    ["start", LucideArrowLeft],
    ["end", LucideArrowRight],
] as const;

@Component({
    selector: "example-overlay-borders",
    imports: [
        DOCKABLE,
        LucideDynamicIcon,
        Toolbar,
        PanelBody,
        ChartPanel,
        KpiPanel,
        TablePanel,
        LogPanel,
    ],
    host: { class: "contents" },
    template: `
        <div [class]="styles.page">
            <example-overlay-borders-toolbar [model]="model" />
            <div [class]="styles.frame">
                <div [dockableRoot]="model" [class]="styles.root">
                    <div dockableBorders>
                        <!-- A border's strip: its tabs, in a row or a column depending on its side. -->
                        <ng-template [dockableBordersBar]="model" let-border>
                            <div [dockableBorder]="border" [class]="styles.border">
                                <div
                                    dockableTabList
                                    [attr.aria-label]="border.location + ' panels'"
                                    [class]="styles.borderTabList"
                                >
                                    <ng-template [dockableTabListItem]="model" let-tab>
                                        <div [dockableTab]="tab" [class]="styles.borderTab">{{ tab.label }}</div>
                                    </ng-template>
                                </div>
                            </div>
                        </ng-template>
                        <ng-template [dockableBordersContent]="model" let-border>
                            <div [dockableBorderContent]="border" [class]="styles.borderContent">
                                <ng-template dockableBorderSplitter let-node>
                                    <div [dockableSplitter]="node" aria-label="Resize" [class]="styles.splitter">
                                        <span aria-hidden="true" [class]="styles.splitterGrip"></span>
                                    </div>
                                </ng-template>
                            </div>
                        </ng-template>
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
                    </div>
                    <ng-template [dockablePanels]="model" let-tab>
                        <div [dockablePanel]="tab" [class]="styles.panel">
                            @switch (tab.component) {
                                @case ("kpi") {
                                    <kit-kpi-panel [label]="tab.label" [seed]="tab.data.seed" />
                                }
                                @case ("doc") {
                                    <kit-panel-body [title]="tab.label">
                                        <p>{{ tab.data.text }}</p>
                                    </kit-panel-body>
                                }
                                @case ("chart") {
                                    <kit-chart-panel
                                        [kind]="tab.data.kind"
                                        [seed]="tab.label.length"
                                        [title]="tab.label"
                                    />
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
                    <!-- The band along each layout edge where a drop docks to that edge, shown
                         during a drag. -->
                    @for (edge of EDGES; track edge[0]) {
                        <div [dockableEdgeIndicator]="edge[0]" [class]="styles.edgeIndicator">
                            <svg [lucideIcon]="edge[1]" aria-hidden="true" [class]="styles.edgeArrow"></svg>
                        </div>
                    }
                </div>
            </div>
        </div>
    `,
})
export default class OverlayBorders {
    protected readonly styles = styles;
    protected readonly EDGES = EDGES;
    protected readonly model = createModel<Types>(json);
}

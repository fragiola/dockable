import { Component, signal } from "@angular/core";
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

// A right-to-left page needs nothing from the layout: `dir="rtl"` on an ancestor of the root (here
// a wrapper; usually <html>) makes `start` the right side. The rows mirror (they are CSS flex), and
// the engine reads the root's direction, so splitters, arrow keys, side, edge and strip drops and
// overlay borders follow the screen. Flipping `dir` repositions the panels by itself.
//
// Two things stay yours: how a start border's labels read (its strip is on the right here, where
// labels read down, so it gets `tabDirection="down"`), and styles, written with logical
// properties (`ps-`, `border-e`, `start-`) so they mirror with the page.

type Types = {
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
    defaults: { border: { size: 220 } },
    borders: [
        {
            location: "start",
            selected: 0,
            children: [
                { component: "kpi", label: "Inbox", data: { seed: 11 } },
                { component: "kpi", label: "Sent", data: { seed: 23 } },
            ],
        },
        {
            location: "bottom",
            size: 160,
            children: [{ component: "log", label: "Console" }],
        },
        {
            location: "end",
            mode: "overlay",
            children: [
                {
                    component: "doc",
                    label: "Notes",
                    data: {
                        text: "An overlay border on the end side: on the left in RTL, over the layout.",
                    },
                },
            ],
        },
    ],
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 55,
                children: [
                    {
                        component: "doc",
                        label: "Message",
                        data: {
                            text: "Start is on the right: this tabset comes first, and its first tab is the rightmost. Drag the splitter, or focus it and press the arrow keys: it moves the way they point. Drag a tab near the right edge to dock it at the start.",
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
                type: "row",
                weight: 45,
                children: [
                    {
                        type: "tabset",
                        children: [{ component: "table", label: "Contacts" }],
                    },
                    {
                        type: "tabset",
                        children: [
                            {
                                component: "chart",
                                label: "Traffic",
                                data: { kind: "line" },
                            },
                        ],
                    },
                ],
            },
        ],
    },
};

// the edge docking targets; the start and end arrows turn with the page (`rtl:` in styles.ts)
const EDGES = [
    ["top", LucideArrowUp],
    ["bottom", LucideArrowDown],
    ["start", LucideArrowLeft],
    ["end", LucideArrowRight],
] as const;

@Component({
    selector: "example-rtl-layout",
    imports: [
        DOCKABLE,
        LucideDynamicIcon,
        PanelBody,
        ChartPanel,
        KpiPanel,
        LogPanel,
        TablePanel,
    ],
    host: { class: "contents" },
    template: `
        <div [attr.dir]="dir()" [class]="styles.page">
            <div [class]="styles.toolbar">
                <button
                    type="button"
                    data-testid="direction"
                    [class]="styles.button"
                    [attr.aria-pressed]="dir() === 'rtl'"
                    (click)="dir.set(dir() === 'rtl' ? 'ltr' : 'rtl')"
                >
                    Right to left
                </button>
                <p dir="auto" [class]="styles.hint">
                    Toggle it: the panels follow the tabsets, and start switches sides.
                </p>
            </div>
            <div [class]="styles.frame">
                <div [dockableRoot]="model" [class]="styles.root">
                    <div dockableBorders>
                        <!-- A border's strip. The start border's labels read down on the right, up
                             on the left. -->
                        <ng-template [dockableBordersBar]="model" let-border>
                            <div
                                [dockableBorder]="border"
                                [tabDirection]="dir() === 'rtl' ? 'down' : 'up'"
                                [class]="styles.border"
                            >
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
                                        <!-- English in an RTL page: dir="auto" keeps its full stop at
                                             its end -->
                                        <p dir="auto">{{ tab.data.text }}</p>
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
export default class RtlLayout {
    protected readonly styles = styles;
    protected readonly EDGES = EDGES;
    protected readonly model = createModel<Types>(json);
    protected readonly dir = signal<"rtl" | "ltr">("rtl");
}

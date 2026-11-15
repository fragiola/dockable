import { Component, signal } from "@angular/core";
import {
    type ComponentOf,
    createModel,
    DOCKABLE,
    type LayoutJson,
} from "@fragiola/dockable-angular";
import {
    LucideBell,
    LucideBookmark,
    LucideDynamicIcon,
    LucideFileText,
    type LucideIcon,
    LucideListTree,
    LucideSearch,
} from "@lucide/angular";
import { PanelBody } from "../_kit/card";
import { type ChartKind, ChartPanel } from "../_kit/charts";
import { LogPanel } from "../_kit/data";
import * as styles from "./styles";

// A side border's tabs read vertically here by default (writing-mode, and half a turn more on a
// start border that reads "up"; see the border template below). Nothing in the package imposes
// it: `[dockableBorder]` only lays its tab list out as a column, and exposes `data-orientation` and
// `data-tab-direction` for your CSS. The toggle below swaps class names, nothing else.

// The side panels serve a report: its outline, a search through it, bookmarks, notes and the
// alerts behind its figures.
type Types = {
    tabs: {
        outline: { headings: string[] };
        search: { query: string; results: string[] };
        bookmarks: { pages: string[] };
        notes: { text: string };
        alerts: undefined;
        document: { summary: string; kind: ChartKind };
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
                {
                    component: "outline",
                    label: "Outline",
                    data: {
                        headings: ["Summary", "Revenue", "Orders", "Outlook"],
                    },
                },
                {
                    component: "search",
                    label: "Search",
                    data: {
                        query: "revenue",
                        results: [
                            "Summary: revenue grew for a third month",
                            "Revenue: by month",
                            "Outlook: revenue targets",
                        ],
                    },
                },
                {
                    component: "bookmarks",
                    label: "Bookmarks",
                    data: { pages: ["Revenue by month", "Refunded orders"] },
                },
            ],
        },
        {
            location: "end",
            children: [
                {
                    component: "notes",
                    label: "Notes",
                    data: {
                        text: "Check the June figures against the payment provider before sharing.",
                    },
                },
                { component: "alerts", label: "Alerts" },
            ],
        },
    ],
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                children: [
                    {
                        component: "document",
                        label: "Document",
                        data: {
                            summary:
                                "Revenue grew for a third month in a row, led by search and direct traffic. Refunds stayed under two percent of orders.",
                            kind: "bar",
                        },
                    },
                ],
            },
        ],
    },
};

// the side panels' icons, by component (the document tab has none)
const icons: { [K in ComponentOf<Types>]?: LucideIcon } = {
    outline: LucideListTree,
    search: LucideSearch,
    bookmarks: LucideBookmark,
    notes: LucideFileText,
    alerts: LucideBell,
};

type Orientation = "vertical" | "horizontal";

const ORIENTATIONS = ["vertical", "horizontal"] as const;

@Component({
    selector: "example-border-tab-orientation",
    imports: [DOCKABLE, LucideDynamicIcon, PanelBody, ChartPanel, LogPanel],
    host: { class: "contents" },
    template: `
        <div [class]="styles.page">
            <div [class]="styles.toolbar">
                <fieldset [class]="styles.toggleGroup">
                    <legend [class]="styles.legend">Side border labels</legend>
                    @for (value of ORIENTATIONS; track value) {
                        <button
                            type="button"
                            [attr.data-testid]="'labels-' + value"
                            [attr.aria-pressed]="orientation() === value"
                            [class]="styles.toggle"
                            (click)="orientation.set(value)"
                        >{{ value === "vertical" ? "Vertical labels" : "Horizontal labels" }}</button>
                    }
                </fieldset>
            </div>
            <div [class]="styles.frame">
                <div [dockableRoot]="model" [class]="styles.root">
                    <div dockableBorders>
                        <!-- A border's strip and its tabs. data-orientation is the direction its
                             tabs run, data-location the side it is on. The orientation toggle
                             changes only their classes (styles.border, styles.borderTab). -->
                        <ng-template [dockableBordersBar]="model" let-border>
                            @let upright = orientation() === "horizontal";
                            <div [dockableBorder]="border" [class]="styles.border(upright)">
                                <div
                                    dockableTabList
                                    [attr.aria-label]="border.location + ' panels'"
                                    [class]="styles.borderTabList"
                                >
                                    <ng-template [dockableTabListItem]="model" let-tab>
                                        <div [dockableTab]="tab" [class]="styles.borderTab(upright)">
                                            @if (icons[tab.component]; as icon) {
                                                <svg [lucideIcon]="icon" aria-hidden="true" [class]="styles.labelIcon"></svg>
                                            }
                                            {{ tab.label }}
                                        </div>
                                    </ng-template>
                                </div>
                            </div>
                        </ng-template>
                        <ng-template [dockableBordersContent]="model" let-border>
                            <div [dockableBorderContent]="border">
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
                                @case ("outline") {
                                    <kit-panel-body [title]="tab.label">
                                        <ol [class]="styles.list">
                                            @for (heading of tab.data.headings; track heading) {
                                                <li>{{ heading }}</li>
                                            }
                                        </ol>
                                    </kit-panel-body>
                                }
                                @case ("search") {
                                    <kit-panel-body [title]="tab.label">
                                        <p [class]="styles.query">{{ "“" + tab.data.query + "”" }}</p>
                                        <ul [class]="styles.list">
                                            @for (result of tab.data.results; track result) {
                                                <li>{{ result }}</li>
                                            }
                                        </ul>
                                    </kit-panel-body>
                                }
                                @case ("bookmarks") {
                                    <kit-panel-body [title]="tab.label">
                                        <ul [class]="styles.list">
                                            @for (page of tab.data.pages; track page) {
                                                <li>{{ page }}</li>
                                            }
                                        </ul>
                                    </kit-panel-body>
                                }
                                @case ("notes") {
                                    <kit-panel-body [title]="tab.label">
                                        <p [class]="styles.text">{{ tab.data.text }}</p>
                                    </kit-panel-body>
                                }
                                @case ("alerts") {
                                    <kit-log-panel />
                                }
                                @case ("document") {
                                    <kit-panel-body [title]="tab.label">
                                        <p [class]="styles.text">{{ tab.data.summary }}</p>
                                        <kit-chart-panel
                                            [kind]="tab.data.kind"
                                            [seed]="21"
                                            [class]="styles.documentChart"
                                        />
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
        </div>
    `,
})
export default class BorderTabOrientation {
    protected readonly styles = styles;
    protected readonly icons = icons;
    protected readonly ORIENTATIONS = ORIENTATIONS;
    protected readonly model = createModel<Types>(json);
    protected readonly orientation = signal<Orientation>("vertical");
}

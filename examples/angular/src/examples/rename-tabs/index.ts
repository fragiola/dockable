import { Component, signal } from "@angular/core";
import {
    createModel,
    DOCKABLE,
    type LayoutJson,
    type TabOf,
} from "@fragiola/dockable-angular";
import { PanelBody } from "../_kit/card";
import { type ChartKind, ChartPanel, KpiPanel } from "../_kit/charts";
import { RenameField } from "../_kit/rename-field";
import * as styles from "./styles";

// Inline rename: double-click a tab (or press F2 on it) and type. Enter confirms, Escape cancels,
// an empty name is refused. The package has no rename UI: the name is the tab's `label`, and
// renaming is one command, `tab.rename` with the new label, whatever the tab's component.
// Whether a tab may be renamed is the tab's `renamable` (true unless set), and the model enforces it.

// The chart's title and the KPI's caption are the tab's label: a rename shows in the content too.
type Types = {
    tabs: {
        note: { text: string };
        chart: { kind: ChartKind; seed: number };
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
                weight: 55,
                children: [
                    {
                        component: "note",
                        label: "Untitled",
                        data: {
                            text: "Double-click a tab, or focus it and press F2, to rename it.",
                        },
                    },
                    {
                        component: "chart",
                        label: "Sketch",
                        data: { kind: "area", seed: 5 },
                    },
                    {
                        component: "note",
                        label: "Fixed name",
                        // this one cannot be renamed: tab.rename refuses it
                        renamable: false,
                        data: {
                            text: "This tab keeps its name: it is renamable: false.",
                        },
                    },
                ],
            },
            {
                type: "tabset",
                weight: 45,
                children: [
                    { component: "kpi", label: "Ideas", data: { seed: 12 } },
                ],
            },
        ],
    },
};

@Component({
    selector: "example-rename-tabs",
    imports: [DOCKABLE, PanelBody, ChartPanel, KpiPanel, RenameField],
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
                                            <!-- the tab keeps its own draggable (a binding of ours would fight the part's) -->
                                            <div
                                                [dockableTab]="tab"
                                                [class]="styles.tab"
                                                (dblclick)="start(tab)"
                                                (keydown)="onKeydown($event, tab)"
                                            >
                                                @if (editing() === tab.id) {
                                                    <kit-rename-field
                                                        [name]="tab.label"
                                                        (commit)="commit(tab, $event)"
                                                        (cancel)="editing.set(null)"
                                                    />
                                                } @else {
                                                    <span [class]="styles.tabName">{{ tab.label }}</span>
                                                }
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
                            @case ("note") {
                                <kit-panel-body [title]="tab.label">
                                    <p [class]="styles.hint">{{ tab.data.text }}</p>
                                </kit-panel-body>
                            }
                            @case ("chart") {
                                <kit-chart-panel [kind]="tab.data.kind" [seed]="tab.data.seed" [title]="tab.label" />
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
export default class RenameTabs {
    protected readonly styles = styles;
    protected readonly model = createModel<Types>(json);
    // one tab at most is being renamed
    protected readonly editing = signal<string | null>(null);

    // ask the model whether this tab may be renamed (its `renamable`, and any middleware)
    protected start(tab: TabOf<Types>) {
        if (this.model.can("tab.rename", { tabId: tab.id, label: tab.label })) {
            this.editing.set(tab.id);
        }
    }

    protected onKeydown(event: KeyboardEvent, tab: TabOf<Types>) {
        if (event.key === "F2") {
            this.start(tab);
        }
    }

    protected commit(tab: TabOf<Types>, name: string) {
        this.model.run("tab.rename", { tabId: tab.id, label: name });
        this.editing.set(null);
    }
}

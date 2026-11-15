import { Component } from "@angular/core";
import {
    createModel,
    DOCKABLE,
    type LayoutJson,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable-angular";
import { type ChartKind, ChartPanel, KpiPanel } from "../_kit/charts";
import { TablePanel } from "../_kit/data";
import * as styles from "./styles";

// No drop outline at all (the root has no `[dockableDropIndicator]`): the targets show themselves.
// While a drag would drop into (or beside) a tabset, it has `data-drop-target` and
// `data-drop-location` (center, top, bottom, start, end); a drop into its tab strip also gives the
// insertion index. The styles read only those: a layer in the tabset, above its panel, fills the
// part the drop would take, and a caret marks the insertion point in the strip.

// What the layout holds: one component per kind of content, each named by its label.
type Types = {
    tabs: {
        chart: { kind: ChartKind; seed: number };
        kpi: { seed: number; unit?: string };
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
                weight: 40,
                children: [
                    {
                        component: "chart",
                        label: "Alpha",
                        data: { kind: "line", seed: 3 },
                    },
                    { component: "kpi", label: "Beta", data: { seed: 11 } },
                    {
                        component: "chart",
                        label: "Gamma",
                        data: { kind: "pie", seed: 17 },
                    },
                ],
            },
            {
                type: "row",
                weight: 60,
                children: [
                    {
                        type: "tabset",
                        children: [
                            {
                                component: "chart",
                                label: "Delta",
                                data: { kind: "bar", seed: 8 },
                            },
                            { component: "table", label: "Epsilon" },
                        ],
                    },
                    {
                        type: "tabset",
                        children: [
                            {
                                component: "kpi",
                                label: "Zeta",
                                data: { seed: 25, unit: "$" },
                            },
                        ],
                    },
                ],
            },
        ],
    },
};

@Component({
    selector: "example-drop-target-highlight",
    imports: [DOCKABLE, ChartPanel, KpiPanel, TablePanel],
    host: { class: "contents" },
    template: `
        <div [class]="styles.frame">
            <div [dockableRoot]="model" [class]="styles.root">
                <div dockableRow>
                    <ng-template [dockableRowChild]="model" let-node>
                        @if (node.type === "row") {
                            <div [dockableRow]="node"></div>
                        } @else {
                            <!-- A tabset that marks itself while it is a drop target: the part the
                                 drop would take, or a caret in its strip. Its state is the one its
                                 data-* come from: is a strip drop aimed here, and where? -->
                            <div [dockableTabSet]="node" #tabset="dockableTabSet" [class]="styles.tabset">
                                <div [class]="styles.strip">
                                    <div dockableTabList aria-label="Tabs" [class]="styles.tabList">
                                        <ng-template [dockableTabListItem]="model" let-tab>
                                            @let caret = caretOf(node, tab, tabset.state().dropIndex);
                                            <div [dockableTab]="tab" [class]="styles.tab">
                                                <span [class]="styles.tabName">{{ tab.label }}</span>
                                                <!-- the strip's insertion point, before (or after) this tab -->
                                                @if (caret !== undefined) {
                                                    <span aria-hidden="true" [class]="styles.dropCaret(caret)"></span>
                                                }
                                            </div>
                                        </ng-template>
                                    </div>
                                </div>
                                <div dockableTabSetContent></div>
                                <span aria-hidden="true" [class]="styles.dropHighlight"></span>
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
                <!-- A tab's content: tab.data and the component narrow together. -->
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
                                <kit-kpi-panel
                                    [label]="tab.label"
                                    [seed]="tab.data.seed"
                                    [unit]="tab.data.unit ?? ''"
                                />
                            }
                            @case ("table") {
                                <kit-table-panel />
                            }
                        }
                    </div>
                </ng-template>
                <!-- no [dockableDropIndicator]: the highlights in the tabsets replace the outline -->
            </div>
        </div>
    `,
})
export default class DropTargetHighlight {
    protected readonly styles = styles;
    protected readonly model = createModel<Types>(json);

    /**
     * Where the strip's caret sits on this tab: before it (`false`), after it (`true`, the last
     * tab when the drop is at the end), or nowhere.
     */
    protected caretOf(
        tabset: TabsetNode<Types>,
        tab: TabOf<Types>,
        dropIndex: number | undefined,
    ) {
        const tabs = tabset.children;
        const index = tabs.findIndex((t) => t.id === tab.id);
        if (dropIndex === index) return false;
        if (dropIndex === tabs.length && index === tabs.length - 1) {
            return true;
        }
        return undefined;
    }
}

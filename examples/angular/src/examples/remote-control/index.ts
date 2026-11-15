import { Component, computed, input, output, signal } from "@angular/core";
import {
    type CommandResult,
    createModel,
    DOCKABLE,
    injectModelState,
    type LayoutJson,
    MAIN_LAYOUT,
    type Model,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable-angular";
import { ChartPanel } from "../_kit/charts";
import { TablePanel } from "../_kit/data";
import * as styles from "./styles";

// The layout driven from code. The panel on the left lists the tabsets and their tabs
// (`model.get("tabsets")`, re-read on every commit) and runs commands on the tab you are looking
// at and its tabset. Each button asks the model first: `model.check` is the dry run of the same
// command, so a refused one is disabled and says why (a pinned tab cannot close or move, the
// right tabset cannot close, a tabset alone in its layout cannot maximize). The last result shows
// below. Nothing here touches the DOM: the layout follows the model.

type Types = {
    tabs: {
        chart: { kind: "line" | "bar" | "area" | "donut" };
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
                id: "left",
                weight: 50,
                children: [
                    {
                        component: "chart",
                        label: "Overview",
                        data: { kind: "area" },
                        pinned: true,
                    },
                    {
                        component: "chart",
                        label: "Revenue",
                        data: { kind: "bar" },
                    },
                    { component: "table", label: "Orders" },
                ],
            },
            {
                type: "tabset",
                id: "right",
                weight: 50,
                closable: false,
                children: [
                    {
                        component: "chart",
                        label: "Share",
                        data: { kind: "donut" },
                    },
                    {
                        component: "chart",
                        label: "Traffic",
                        data: { kind: "line" },
                    },
                ],
            },
        ],
    },
};

/** The tabsets' names in the panel: the two of the JSON, then a number for each new one. */
function tabsetName(tabset: TabsetNode<Types>, index: number) {
    if (tabset.id === "left") return "Left";
    if (tabset.id === "right") return "Right";
    return `Tabset ${index + 1}`;
}

/**
 * A command button: disabled when its dry run (`model.check`) is refused, with the reason as its
 * tooltip. `model.can` answers the same question with a boolean; `check` also says why.
 */
@Component({
    selector: "example-action",
    host: { class: "contents" },
    template: `
        <button
            type="button"
            [disabled]="!dryRun().ok"
            [attr.title]="reason()"
            [class]="styles.action"
            (click)="run.emit()"
        ><ng-content /></button>
    `,
})
class Action {
    readonly dryRun = input.required<CommandResult<unknown>>();
    readonly run = output();
    protected readonly styles = styles;
    protected readonly reason = computed(() => {
        const result = this.dryRun();
        return result.ok ? null : result.error.message;
    });
}

/**
 * The panel beside the layout: it reads a new snapshot on every commit, and the dry runs below
 * with it. A component of its own, so a commit re-renders it, not the layout.
 */
@Component({
    selector: "example-remote-panel",
    imports: [Action],
    host: { class: "contents" },
    template: `
        <aside aria-label="Remote control" [class]="styles.remote">
            <section [class]="styles.section">
                <h2 [class]="styles.heading">Layout</h2>
                @for (node of state().tabsets; track node.id; let index = $index) {
                    <div [class]="styles.tree">
                        <button
                            type="button"
                            [attr.aria-pressed]="node.id === state().tabset?.id"
                            [class]="styles.treeTabset"
                            (click)="report('tabset.activate', model().run('tabset.activate', { tabsetId: node.id }))"
                        >{{ tabsetName(node, index) }}</button>
                        @for (child of node.children; track child.id) {
                            <button
                                type="button"
                                [attr.aria-pressed]="child.id === state().selected[node.id]"
                                [class]="styles.treeTab"
                                (click)="report('tab.select', model().run('tab.select', { tabId: child.id }))"
                            >{{ child.label }}</button>
                        }
                    </div>
                }
            </section>
            @if (state().tab; as tab) {
                @if (state().tabset; as tabset) {
                    <section [class]="styles.section">
                        <h2 [class]="styles.heading">{{ "Tab: " + tab.label }}</h2>
                        @for (other of others(); track other.node.id) {
                            <example-action
                                [dryRun]="model().check('tab.move', { tabId: tab.id, to: other.node.id })"
                                (run)="report('tab.move', model().run('tab.move', { tabId: tab.id, to: other.node.id }))"
                            >{{ "Move to " + tabsetName(other.node, other.index) }}</example-action>
                        }
                        <!-- to a layout id, with an edge: docks beside the whole layout -->
                        <example-action
                            [dryRun]="model().check('tab.move', { tabId: tab.id, to: MAIN_LAYOUT, location: 'bottom' })"
                            (run)="report('tab.move', model().run('tab.move', { tabId: tab.id, to: MAIN_LAYOUT, location: 'bottom' }))"
                        >Dock at the bottom</example-action>
                        <example-action
                            [dryRun]="model().check('tab.close', { tabId: tab.id })"
                            (run)="report('tab.close', model().run('tab.close', { tabId: tab.id }))"
                        >Close tab</example-action>
                    </section>
                    <section [class]="styles.section">
                        <h2 [class]="styles.heading">{{ "Tabset: " + tabsetName(tabset, state().tabsets.indexOf(tabset)) }}</h2>
                        <example-action
                            [dryRun]="model().check('tabset.maximize', { tabsetId: tabset.id, value: !state().maximized })"
                            (run)="report('tabset.maximize', model().run('tabset.maximize', { tabsetId: tabset.id, value: !state().maximized }))"
                        >{{ state().maximized ? "Restore" : "Maximize" }}</example-action>
                        <!-- an edge of a tabset splits it: the new tab gets a tabset of its own -->
                        <example-action
                            [dryRun]="model().check('tab.add', { component: 'table', label: 'New table', to: tabset.id, location: 'end' })"
                            (run)="addBeside(tabset.id)"
                        >Add a tab beside</example-action>
                        <example-action
                            [dryRun]="model().check('tabset.close', { tabsetId: tabset.id })"
                            (run)="report('tabset.close', model().run('tabset.close', { tabsetId: tabset.id }))"
                        >Close tabset</example-action>
                    </section>
                }
            }
            <p role="status" data-testid="last" [class]="styles.status">{{ last() }}</p>
        </aside>
    `,
})
class RemotePanel {
    readonly model = input.required<Model<Types>>();
    protected readonly styles = styles;
    protected readonly MAIN_LAYOUT = MAIN_LAYOUT;
    protected readonly tabsetName = tabsetName;
    protected readonly last = signal("No command yet");
    // a new snapshot on every commit: the template's dry runs are asked again with it
    protected readonly state = injectModelState<
        Types,
        {
            tabsets: TabsetNode<Types>[];
            tabset: TabsetNode<Types> | undefined;
            tab: TabOf<Types> | undefined;
            maximized: boolean;
            /** Each tabset's selected tab. */
            selected: Record<string, string | undefined>;
        }
    >(
        (_state, model) => {
            const tabset = model.get("default-tabset");
            const tabsets = model.get("tabsets");
            return {
                tabsets,
                tabset,
                tab: tabset
                    ? model.get("selected-tab-by", { tabsetId: tabset.id })
                    : undefined,
                maximized:
                    tabset !== undefined &&
                    model.is("tabset-maximized", { tabsetId: tabset.id }),
                selected: Object.fromEntries(
                    tabsets.map((node) => [
                        node.id,
                        model.get("selected-tab-by", { tabsetId: node.id })?.id,
                    ]),
                ),
            };
        },
        { model: this.model },
    );
    /** The tabsets a tab can move to, with their index for their name. */
    protected readonly others = computed(() => {
        const { tabsets, tabset } = this.state();
        return tabsets
            .map((node, index) => ({ node, index }))
            .filter((other) => other.node.id !== tabset?.id);
    });

    /** Runs a command and reports its result in the status line. */
    protected report(command: string, result: CommandResult<unknown>) {
        this.last.set(
            result.ok
                ? `${command}: done`
                : `${command}: ${result.error.code} (${result.error.message})`,
        );
    }

    protected addBeside(tabsetId: string) {
        const model = this.model();
        this.report(
            "tab.add",
            model.run("tab.add", {
                component: "table",
                label: `Table ${model.get("all-tabs").length + 1}`,
                to: tabsetId,
                location: "end",
                select: true,
            }),
        );
    }
}

@Component({
    selector: "example-remote-control",
    imports: [DOCKABLE, ChartPanel, TablePanel, RemotePanel],
    host: { class: "contents" },
    template: `
        <div [class]="styles.page">
            <example-remote-panel [model]="model" />
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
                                    <kit-chart-panel
                                        [kind]="tab.data.kind"
                                        [seed]="tab.label.length"
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
        </div>
    `,
})
export default class RemoteControl {
    protected readonly styles = styles;
    protected readonly model = createModel<Types>(json);
}

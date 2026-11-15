import { Component, signal } from "@angular/core";
import {
    type BatchEntry,
    createModel,
    DOCKABLE,
    type LayoutJson,
    type Model,
    type TabOf,
} from "@fragiola/dockable-angular";
import { CONTEXT_MENU } from "#/components/ui/context-menu";
import { PanelBody } from "../_kit/card";
import { type ChartKind, ChartPanel, KpiPanel } from "../_kit/charts";
import { LogPanel, TablePanel } from "../_kit/data";
import * as styles from "./styles";

// A Fragiola ContextMenu on every tab. The package provides the commands and `model.can`, which
// says whether a command would apply; the menu (and its text) is the consumer's. The tab IS the
// menu's trigger: `kitContextMenuTrigger` goes on the `[dockableTab]` element.

type Types = {
    tabs: {
        note: { text: string };
        chart: { kind: ChartKind; seed: number };
        kpi: { seed: number };
        log: undefined;
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
                weight: 60,
                children: [
                    {
                        component: "note",
                        label: "Overview",
                        data: {
                            text: "Right-click a tab (or long-press it) for its menu.",
                        },
                    },
                    {
                        component: "note",
                        label: "Settings",
                        data: {
                            text: "This tab cannot be closed: Close is disabled in its menu.",
                        },
                        // not closable: `tab.close` refuses it, so Close is disabled in its menu
                        closable: false,
                    },
                    { component: "log", label: "Activity" },
                    {
                        component: "chart",
                        label: "Reports",
                        data: { kind: "bar", seed: 21 },
                    },
                ],
            },
            {
                type: "tabset",
                weight: 40,
                children: [
                    { component: "table", label: "Inbox" },
                    { component: "kpi", label: "Drafts", data: { seed: 6 } },
                ],
            },
        ],
    },
};

/** What a tab's menu offers, read when it opens. */
type MenuState = ReturnType<typeof menuState>;

/**
 * What the menu offers, asked without applying anything (`model.can` answers through the
 * middleware). The menu's content renders when it opens: ask then.
 */
function menuState(model: Model<Types>, tab: TabOf<Types>) {
    // a tab lives in a tabset or a border; maximize is a tabset's
    const parent = model.get("node-parent-by", { nodeId: tab.id });
    const tabset = parent?.type === "tabset" ? parent : undefined;
    const siblings = parent && parent.type !== "row" ? parent.children : [];
    const right = siblings.slice(
        siblings.findIndex((t) => t.id === tab.id) + 1,
    );
    // what a command would do, asked without applying it (middleware included)
    const closable = (tabs: readonly TabOf<Types>[]) =>
        tabs.filter((t) => model.can("tab.close", { tabId: t.id }));
    const pinned = tab.pinned === true;
    const maximized =
        tabset !== undefined &&
        model.is("tabset-maximized", { tabsetId: tabset.id });
    return {
        tabset,
        others: closable(siblings.filter((t) => t.id !== tab.id)),
        toTheRight: closable(right),
        pinned,
        maximized,
        canClose: model.can("tab.close", { tabId: tab.id }),
        canPin: model.can("tab.pin", { tabId: tab.id, value: !pinned }),
        canMaximize:
            tabset !== undefined &&
            model.can("tabset.maximize", {
                tabsetId: tabset.id,
                value: !maximized,
            }),
    };
}

@Component({
    selector: "example-tab-context-menu",
    imports: [
        DOCKABLE,
        CONTEXT_MENU,
        PanelBody,
        ChartPanel,
        KpiPanel,
        LogPanel,
        TablePanel,
    ],
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
                                            <div
                                                [dockableTab]="tab"
                                                [kitContextMenuTrigger]="tabMenu"
                                                (openChange)="$event && open(tab)"
                                                [class]="styles.tab"
                                            >
                                                <span [class]="styles.tabName">{{ tab.label }}</span>
                                            </div>
                                            <ng-template #tabMenu>
                                                @let state = menu()!;
                                                <div kitContextMenuContent>
                                                    <div
                                                        kitContextMenuItem
                                                        [disabled]="!state.canClose"
                                                        (select)="model.run('tab.close', { tabId: tab.id })"
                                                    >Close</div>
                                                    <div
                                                        kitContextMenuItem
                                                        [disabled]="state.others.length === 0"
                                                        (select)="closeAll(state.others)"
                                                    >Close others</div>
                                                    <div
                                                        kitContextMenuItem
                                                        [disabled]="state.toTheRight.length === 0"
                                                        (select)="closeAll(state.toTheRight)"
                                                    >Close to the right</div>
                                                    <div kitContextMenuSeparator></div>
                                                    <!-- refused for a tab in a border (only a tabset has a pinned run) -->
                                                    <div
                                                        kitContextMenuItem
                                                        [disabled]="!state.canPin"
                                                        (select)="model.run('tab.pin', { tabId: tab.id, value: !state.pinned })"
                                                    >{{ state.pinned ? "Unpin" : "Pin" }}</div>
                                                    <div
                                                        kitContextMenuItem
                                                        [disabled]="!state.canMaximize"
                                                        (select)="toggleMaximized(state)"
                                                    >{{ state.maximized ? "Restore tabset" : "Maximize tabset" }}</div>
                                                </div>
                                            </ng-template>
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
                            @case ("log") {
                                <kit-log-panel />
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
export default class TabContextMenu {
    protected readonly styles = styles;
    protected readonly model = createModel<Types>(json);
    /** The open menu's state (one menu is open at a time). */
    protected readonly menu = signal<MenuState | undefined>(undefined);

    protected open(tab: TabOf<Types>) {
        this.menu.set(menuState(this.model, tab));
    }

    // several closes are one command (one change event, one undo step): all apply or none
    protected closeAll(tabs: readonly TabOf<Types>[]) {
        this.model.run("batch", {
            commands: tabs.map(
                (t): BatchEntry<Types> => ({
                    command: "tab.close",
                    payload: { tabId: t.id },
                }),
            ),
        });
    }

    protected toggleMaximized({ tabset, maximized }: MenuState) {
        if (tabset) {
            this.model.run("tabset.maximize", {
                tabsetId: tabset.id,
                value: !maximized,
            });
        }
    }
}

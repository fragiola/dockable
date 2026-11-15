import {
    Component,
    DestroyRef,
    effect,
    inject,
    input,
    signal,
} from "@angular/core";
import {
    type CommandEvent,
    type CommandName,
    createModel,
    DOCKABLE,
    injectDockable,
    injectModelState,
    type LayoutJson,
    type Model,
    type RowNode,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable-angular";
import {
    LucideMaximize2,
    LucideMinimize2,
    LucidePlus,
    LucideX,
} from "@lucide/angular";
import { type ChartKind, ChartPanel, KpiPanel } from "../_kit/charts";
import * as styles from "./styles";
import { type Toast, Toaster, Toasts } from "./toasts";

// The layout tells the app what happened: `model.subscribe` delivers one event per committed
// command, whoever issued it (a drag, a close button, a keyboard shortcut, the Add button). The app
// decides what deserves a reaction. Here: a toast per kind of command, each worded for that kind,
// and a closed tab's toast offers Undo, which adds the tab back where it was: the event carries
// the state before the close (`event.before`), where the tab, its tabset and its place are found.
// The switches mute kinds: the listener sees every command, the app picks.

type Types = {
    tabs: {
        chart: { kind: ChartKind };
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
                    {
                        component: "chart",
                        label: "Revenue",
                        data: { kind: "bar" },
                    },
                    {
                        component: "chart",
                        label: "Traffic",
                        data: { kind: "area" },
                    },
                ],
            },
            {
                type: "row",
                weight: 40,
                children: [
                    {
                        type: "tabset",
                        children: [
                            {
                                component: "kpi",
                                label: "Orders",
                                data: { seed: 3 },
                            },
                            {
                                component: "kpi",
                                label: "Refunds",
                                data: { seed: 12 },
                            },
                        ],
                    },
                    {
                        type: "tabset",
                        children: [
                            {
                                component: "chart",
                                label: "Share",
                                data: { kind: "donut" },
                            },
                        ],
                    },
                ],
            },
        ],
    },
};

/** The kinds of command that can raise a toast, and the switch that mutes each. */
const KINDS = [
    { command: "tab.close", label: "Close" },
    { command: "tab.move", label: "Move" },
    { command: "tabset.maximize", label: "Maximize" },
    { command: "tab.add", label: "Add" },
    { command: "tab.select", label: "Select" },
] as const satisfies readonly { command: CommandName; label: string }[];

/**
 * A field of an event's payload or result. `CommandEvent` types both as `unknown` (one listener
 * sees every command), so the example reads the fields it needs and checks their type.
 */
function field(value: unknown, key: string): unknown {
    return typeof value === "object" && value !== null
        ? Reflect.get(value, key)
        : undefined;
}

/** Where a tab is in a layout's state: its tabset and its place in the strip. */
interface Place {
    tab: TabOf<Types>;
    tabsetId: string;
    index: number;
}

/** Finds a tab in a row of a state: the event's `before` or `after`. */
function placeOf(row: RowNode<Types>, tabId: string): Place | undefined {
    for (const child of row.children) {
        if (child.type === "row") {
            const found = placeOf(child, tabId);
            if (found) return found;
            continue;
        }
        const index = child.children.findIndex((tab) => tab.id === tabId);
        const tab = child.children[index];
        if (tab) return { tab, tabsetId: child.id, index };
    }
    return undefined;
}

/** Adds a closed tab back where it was (its tabset, its place), or to the active tabset. */
function reopen(model: Model<Types>, { tab, tabsetId, index }: Place) {
    const home = model.get("node-by", { id: tabsetId });
    const to =
        home?.type === "tabset" ? home.id : model.get("default-tabset")?.id;
    if (!to) return;
    // a tab node says `type: "tab"`, which `tab.add` does not take: the rest is its init
    const { type: _type, ...init } = tab;
    model.run("tab.add", { ...init, to, index, select: true });
}

/** The words of a toast for one event, or nothing for a command the example does not announce. */
function describe(
    model: Model<Types>,
    event: CommandEvent<Types>,
): Omit<Toast, "id"> | undefined {
    if (event.command === "tabset.maximize") {
        return field(event.payload, "value") === true
            ? { tone: "info", title: "Maximized a tabset" }
            : { tone: "info", title: "Restored the layout" };
    }
    const tabId = field(event.result, "tabId");
    if (typeof tabId !== "string") return undefined;
    // a closed tab is only in the state before the event, an added one only in the state after it
    const before = placeOf(event.before.root, tabId);
    const after = placeOf(event.after.root, tabId);
    const name = (before ?? after)?.tab.label ?? "a tab";
    switch (event.command) {
        case "tab.close":
            return {
                tone: "danger",
                title: `Closed ${name}`,
                action: before && {
                    label: "Undo",
                    run: () => reopen(model, before),
                },
            };
        case "tab.move": {
            const location = field(event.payload, "location");
            return {
                tone: "info",
                title: `Moved ${name}`,
                detail:
                    typeof location === "string" && location !== "center"
                        ? `Docked ${location}`
                        : before?.tabsetId === after?.tabsetId
                          ? "Reordered in its tabset"
                          : "Into another tabset",
            };
        }
        case "tab.add":
            return { tone: "success", title: `Added ${name}` };
        case "tab.select":
            return { tone: "neutral", title: `Showing ${name}` };
        default:
            return undefined;
    }
}

/** A tabset's button that maximizes or restores it, when the model allows it. */
@Component({
    selector: "example-maximize-button",
    imports: [LucideMaximize2, LucideMinimize2],
    host: { class: "contents" },
    template: `
        @if (state().can) {
            <button
                type="button"
                [attr.aria-label]="state().maximized ? 'Restore' : 'Maximize'"
                [class]="styles.stripButton"
                (click)="toggle()"
            >
                @if (state().maximized) {
                    <svg lucideMinimize2 aria-hidden="true" [class]="styles.icon"></svg>
                } @else {
                    <svg lucideMaximize2 aria-hidden="true" [class]="styles.icon"></svg>
                }
            </button>
        }
    `,
})
class MaximizeButton {
    readonly tabset = input.required<TabsetNode<Types>>();
    protected readonly styles = styles;
    private readonly model = injectDockable<Types>().model;
    protected readonly state = injectModelState<
        Types,
        { maximized: boolean; can: boolean }
    >(
        (_state, model) => {
            const tabsetId = this.tabset().id;
            const maximized = model.is("tabset-maximized", { tabsetId });
            return {
                maximized,
                can: model.can("tabset.maximize", {
                    tabsetId,
                    value: !maximized,
                }),
            };
        },
        { isEqual: (a, b) => a.maximized === b.maximized && a.can === b.can },
    );

    protected toggle() {
        this.model().run("tabset.maximize", {
            tabsetId: this.tabset().id,
            value: !this.state().maximized,
        });
    }
}

@Component({
    selector: "example-event-toasts",
    imports: [
        DOCKABLE,
        LucidePlus,
        LucideX,
        ChartPanel,
        KpiPanel,
        Toaster,
        MaximizeButton,
    ],
    host: { class: "contents" },
    template: `
        <div [class]="styles.toolbar">
            <fieldset aria-label="Toast on" [class]="styles.kinds">
                @for (kind of KINDS; track kind.command) {
                    <button
                        type="button"
                        [attr.aria-pressed]="!muted().has(kind.command)"
                        [class]="styles.kind"
                        (click)="toggle(kind.command)"
                    >{{ kind.label }}</button>
                }
            </fieldset>
            <button type="button" [class]="styles.button" (click)="addChart()">
                <svg lucidePlus aria-hidden="true" [class]="styles.icon"></svg>
                Add a chart
            </button>
        </div>
        <div [class]="styles.frame">
            <div [dockableRoot]="model" [class]="styles.root">
                <div dockableRow>
                    <ng-template [dockableRowChild]="model" let-node>
                        @if (node.type === "row") {
                            <div [dockableRow]="node"></div>
                        } @else {
                            <!-- A tabset: closable tabs, and a button that maximizes or restores it. -->
                            <div [dockableTabSet]="node" [class]="styles.tabset">
                                <div [class]="styles.strip">
                                    <div dockableTabList aria-label="Tabs" [class]="styles.tabList">
                                        <ng-template [dockableTabListItem]="model" let-tab>
                                            <div [dockableTab]="tab" [class]="styles.tab">
                                                <span [class]="styles.tabName">{{ tab.label }}</span>
                                                <!-- the tab is the tab stop: Ctrl+Delete on it closes it from the
                                                     keyboard; the press must not activate the tabset, and a click on
                                                     the tab would select it -->
                                                <button
                                                    type="button"
                                                    tabindex="-1"
                                                    [attr.aria-label]="'Close ' + tab.label"
                                                    [class]="styles.closeButton"
                                                    (pointerdown)="$event.stopPropagation()"
                                                    (click)="close($event, tab)"
                                                >
                                                    <svg lucideX aria-hidden="true" [class]="styles.closeIcon"></svg>
                                                </button>
                                            </div>
                                        </ng-template>
                                    </div>
                                    <example-maximize-button [tabset]="node" />
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
            <example-toaster [store]="toasts" />
        </div>
    `,
})
export default class EventToasts {
    protected readonly styles = styles;
    protected readonly KINDS = KINDS;
    protected readonly model = createModel<Types>(json);
    protected readonly toasts = new Toasts();
    protected readonly muted = signal<ReadonlySet<CommandName>>(
        new Set(["tab.select"]),
    );
    private added = 0;

    constructor() {
        effect((onCleanup) => {
            const muted = this.muted();
            onCleanup(
                this.model.subscribe((event) => {
                    // a splitter drag commits many transient steps: none of them is news
                    if (event.transient || muted.has(event.command)) return;
                    const toast = describe(this.model, event);
                    if (toast) this.toasts.show(toast);
                }),
            );
        });
        inject(DestroyRef).onDestroy(() => this.toasts.destroy());
    }

    protected toggle(command: CommandName) {
        this.muted.update((current) => {
            const next = new Set(current);
            if (!next.delete(command)) next.add(command);
            return next;
        });
    }

    protected addChart() {
        const tabset = this.model.get("default-tabset");
        if (!tabset) return;
        this.added += 1;
        this.model.run("tab.add", {
            component: "chart",
            label: `Chart ${this.added}`,
            data: { kind: "line" },
            to: tabset.id,
            select: true,
        });
    }

    protected close(event: Event, tab: TabOf<Types>) {
        event.stopPropagation(); // a click on the tab would select it
        this.model.run("tab.close", { tabId: tab.id });
    }
}

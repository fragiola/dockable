import { Component, effect, signal } from "@angular/core";
import {
    createModel,
    DOCKABLE,
    type LayoutJson,
    LayoutValidationError,
    type Middleware,
    type Model,
    veto,
} from "@fragiola/dockable-angular";
import {
    LucideDynamicIcon,
    LucideLayoutDashboard,
    LucideRotateCcw,
    LucideSave,
} from "@lucide/angular";
import * as styles from "./styles";
import {
    GROUPS,
    isKpi,
    type Types,
    WIDGETS,
    WidgetContent,
    widgetOf,
    widgetTab,
} from "./widgets";

const STORAGE_KEY = "dockable-examples:dashboard-builder:v2";

/** A KPI strip on top (it only takes KPIs), and an empty canvas for everything else. */
const EMPTY: LayoutJson<Types> = {
    version: 1,
    // the canvas stays when its last widget leaves
    defaults: { tabset: { deleteWhenEmpty: false } },
    root: {
        type: "row",
        children: [
            {
                type: "row",
                children: [
                    {
                        type: "tabset",
                        id: "kpis",
                        data: { name: "KPI strip" },
                        weight: 30,
                        minHeight: 130,
                        children: [
                            {
                                component: "kpi-revenue",
                                label: "Revenue",
                            },
                        ],
                    },
                    {
                        type: "tabset",
                        id: "canvas",
                        data: { name: "Canvas" },
                        weight: 70,
                        children: [],
                    },
                ],
            },
        ],
    },
};

/**
 * The drop rules, as middleware: KPIs only into the centre of the KPI strip, and nothing else into
 * it (nor beside it); a tabset that holds KPIs may be docked elsewhere, never merged into another
 * tabset. They guard the commands that place a tab (`tab.add` from the palette, `tab.move` inside
 * the layout) or a tabset (`tabset.move`), from a drag or from code alike; a drag asks them with
 * `model.can` on every hover, so a refused target shows no drop indicator.
 */
const dropRules: Middleware<Types> = (ctx, next) => {
    if (ctx.command === "tabset.move") {
        const { tabsetId, to, location = "center" } = ctx.payload;
        const moved = ctx.get("node-by", { id: tabsetId });
        const carriesKpis =
            moved?.type === "tabset" &&
            moved.children.some((tab) => isKpi(tab.component));
        if (carriesKpis) {
            return location === "center" && to !== "kpis"
                ? veto("KPIs go in the KPI strip")
                : next();
        }
        return to === "kpis" ? veto("The KPI strip takes KPIs only") : next();
    }
    // the placed tab's component: a new tab's (tab.add) or an existing one's (tab.move)
    let component: string | undefined;
    if (ctx.command === "tab.add") {
        component = ctx.payload.component;
    } else if (ctx.command === "tab.move") {
        const moved = ctx.get("node-by", { id: ctx.payload.tabId });
        component = moved?.type === "tab" ? moved.component : undefined;
    } else {
        return next();
    }
    const { to, location = "center" } = ctx.payload;
    const intoKpis = to === "kpis";
    if (component !== undefined && isKpi(component)) {
        return intoKpis && location === "center"
            ? next()
            : veto("KPIs go in the KPI strip");
    }
    return intoKpis ? veto("The KPI strip takes KPIs only") : next();
};

/** What was restored from storage, and why a saved layout could not be. */
interface Restored {
    model: Model<Types>;
    error?: { message: string; issues: string[] } | undefined;
}

function describe(error: unknown): NonNullable<Restored["error"]> {
    if (error instanceof LayoutValidationError) {
        // every problem, with its JSON path in the saved document
        return {
            message: error.message,
            issues: error.issues.map(
                (issue) => `${issue.path || "/"}: ${issue.message}`,
            ),
        };
    }
    return {
        message: error instanceof Error ? error.message : String(error),
        issues: [],
    };
}

/** The saved layout (JSON v1, from `model.get("layout-json")`), or the empty dashboard. */
function restore(): Restored {
    let saved: string | null = null;
    try {
        saved = window.localStorage.getItem(STORAGE_KEY);
    } catch {
        // no storage: start empty
    }
    let restored: Restored;
    try {
        // createModel validates the document: invalid JSON, or a layout that is not v1 (saved by
        // an older version, edited by hand), throws, and the dashboard starts empty
        restored = {
            model: createModel<Types>(saved ? JSON.parse(saved) : EMPTY),
        };
    } catch (error) {
        restored = { model: createModel<Types>(EMPTY), error: describe(error) };
    }
    restored.model.use(dropRules);
    return restored;
}

@Component({
    selector: "example-dashboard-builder",
    imports: [
        DOCKABLE,
        LucideDynamicIcon,
        LucideLayoutDashboard,
        LucideRotateCcw,
        LucideSave,
        WidgetContent,
    ],
    host: { class: "contents" },
    template: `
        <div [class]="styles.page">
            <div [class]="styles.toolbar">
                <h2 [class]="styles.title">Sales dashboard</h2>
                <div [class]="styles.actions">
                    <button type="button" [class]="styles.button" (click)="reset()">
                        <svg lucideRotateCcw aria-hidden="true" [class]="styles.buttonIcon"></svg>
                        Reset
                    </button>
                    <button type="button" [class]="styles.primaryButton" (click)="save()">
                        <svg lucideSave aria-hidden="true" [class]="styles.buttonIcon"></svg>
                        {{ saved() ? "Saved" : "Save layout" }}
                    </button>
                </div>
            </div>
            @if (restoreError(); as error) {
                <div role="alert" [class]="styles.alert">
                    <p>{{ "The saved layout could not be restored: " + error.message }}</p>
                    @if (error.issues.length > 0) {
                        <ul [class]="styles.issues">
                            @for (issue of error.issues.slice(0, 5); track issue) {
                                <li>{{ issue }}</li>
                            }
                        </ul>
                    }
                </div>
            }
            <div [class]="styles.body">
                <aside aria-label="Widget palette" [class]="styles.widgetPalette">
                    @for (group of GROUPS; track group) {
                        <section [attr.aria-labelledby]="'palette-' + group">
                            <h3 [id]="'palette-' + group" [class]="styles.groupTitle">{{ group }}</h3>
                            <ul [class]="styles.groupList">
                                @for (widget of widgetsOf(group); track widget.component) {
                                    <li
                                        [dockableDragSource]="model"
                                        [tab]="tabOf(widget)"
                                        [class]="styles.paletteItem"
                                    >
                                        <svg
                                            [lucideIcon]="widget.icon"
                                            aria-hidden="true"
                                            [class]="styles.paletteItemIcon"
                                        ></svg>
                                        {{ widget.title }}
                                    </li>
                                }
                            </ul>
                        </section>
                    }
                    <p [class]="styles.paletteHint">
                        KPIs go in the strip on top; everything else goes below.
                    </p>
                </aside>
                <div [class]="styles.frame">
                    <div [dockableRoot]="model" [class]="styles.root">
                        <div dockableRow>
                            <ng-template [dockableRowChild]="model" let-node>
                                @if (node.type === "row") {
                                    <div [dockableRow]="node"></div>
                                } @else {
                                    <!-- A tabset: a card with the strip of tabs on top, and a hint in
                                         the empty canvas. -->
                                    <div [dockableTabSet]="node" [class]="styles.tabset">
                                        <div [class]="styles.strip">
                                            <!-- the tabset's name from the layout ("KPI strip", "Canvas") -->
                                            <div
                                                dockableTabList
                                                [attr.aria-label]="node.data?.name || 'Tabs'"
                                                [class]="styles.tabList"
                                            >
                                                <ng-template [dockableTabListItem]="model" let-tab>
                                                    <div [dockableTab]="tab" [class]="styles.tab">
                                                        @if (iconOf(tab); as icon) {
                                                            <svg
                                                                [lucideIcon]="icon"
                                                                aria-hidden="true"
                                                                [class]="styles.tabIcon"
                                                            ></svg>
                                                        }
                                                        <span [class]="styles.tabName">{{ tab.label }}</span>
                                                    </div>
                                                </ng-template>
                                            </div>
                                        </div>
                                        <!-- no panel covers an empty tabset, so its content area can
                                             show a hint -->
                                        <div dockableTabSetContent #content="dockableTabSetContent">
                                            @if (content.state().empty) {
                                                <div [class]="styles.emptyHint">
                                                    <svg
                                                        lucideLayoutDashboard
                                                        aria-hidden="true"
                                                        [class]="styles.emptyHintIcon"
                                                    ></svg>
                                                    <p>Drag charts and tables here.</p>
                                                </div>
                                            }
                                        </div>
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
                                <example-dashboard-widget [tab]="tab" />
                            </div>
                        </ng-template>
                        <!-- Where a dragged widget would land (hidden where the rules refuse it). -->
                        <div
                            dockableDropIndicator
                            #indicator="dockableDropIndicator"
                            [class]="styles.dropIndicator(indicator.state())"
                        ></div>
                    </div>
                </div>
            </div>
        </div>
    `,
})
export default class DashboardBuilder {
    protected readonly styles = styles;
    protected readonly GROUPS = GROUPS;
    // the model is created once; Reset loads the empty layout into it
    private readonly initial = restore();
    protected readonly model = this.initial.model;
    protected readonly restoreError = signal(this.initial.error);
    protected readonly saved = signal(false);

    constructor() {
        effect((onCleanup) => {
            if (!this.saved()) return;
            const timer = setTimeout(() => this.saved.set(false), 1500);
            onCleanup(() => clearTimeout(timer));
        });
    }

    protected widgetsOf(group: (typeof GROUPS)[number]) {
        return WIDGETS.filter((widget) => widget.group === group);
    }

    /** A new tab per drag: a palette item's `tab` is called at each drag start. */
    private readonly tabs = new Map(
        WIDGETS.map((widget) => [widget, () => widgetTab(widget)]),
    );

    protected tabOf(widget: (typeof WIDGETS)[number]) {
        // biome-ignore lint/style/noNonNullAssertion: every widget has its entry
        return this.tabs.get(widget)!;
    }

    protected iconOf(tab: Parameters<typeof widgetOf>[0]) {
        return widgetOf(tab)?.icon;
    }

    protected save() {
        try {
            window.localStorage.setItem(
                STORAGE_KEY,
                // the layout document (JSON v1): what createModel and layout.load read back
                JSON.stringify(this.model.get("layout-json")),
            );
            this.saved.set(true);
        } catch {
            // storage unavailable: nothing to save to
        }
    }

    protected reset() {
        try {
            window.localStorage.removeItem(STORAGE_KEY);
        } catch {
            // storage unavailable
        }
        // the same model, a new state: the rules stay installed
        this.model.run("layout.load", { layout: EMPTY });
        this.restoreError.set(undefined);
    }
}

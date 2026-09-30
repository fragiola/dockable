"use client";

import {
    createModel,
    type LayoutJson,
    LayoutValidationError,
    type Middleware,
    type Model,
    type TabOf,
    type TabsetNode,
    veto,
} from "@fragiola/dockable";
import { Dockable } from "@fragiola/dockable-react";
import { LayoutDashboard, RotateCcw, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "#/lib/cn";
import { DockLayout } from "../_kit/layout";
import * as styles from "../_kit/styles";
import { KitTabButton, KitTabStrip } from "../_kit/tab-strip";
import {
    GROUPS,
    isKpi,
    type Types,
    WIDGETS,
    type Widget,
    WidgetContent,
    widgetOf,
    widgetTab,
} from "./widgets";

const STORAGE_KEY = "dockable-examples:dashboard-builder";

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
                                data: { name: "Revenue" },
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
    // the command narrows the payload
    if (ctx.command === "tabset.move") {
        const { tabset, to, location = "center" } = ctx.payload;
        const moved = ctx.get(tabset);
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
    let placed: {
        component: string | undefined;
        to: string;
        location?: string;
    };
    if (ctx.command === "tab.add") {
        placed = ctx.payload;
    } else if (ctx.command === "tab.move") {
        const moved = ctx.get(ctx.payload.tab);
        placed = {
            ...ctx.payload,
            component: moved?.type === "tab" ? moved.component : undefined,
        };
    } else {
        return next();
    }
    const intoKpis = placed.to === "kpis";
    if (placed.component !== undefined && isKpi(placed.component)) {
        return intoKpis && (placed.location ?? "center") === "center"
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

/** The saved layout (JSON v1, from `model.toJSON()`), or the empty dashboard. */
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

function PaletteItem({
    model,
    widget,
}: {
    model: Model<Types>;
    widget: Widget;
}) {
    const Icon = widget.icon;
    return (
        <Dockable.DragSource
            model={model}
            tab={() => widgetTab(widget)}
            render={<li />}
            className={cn(
                "palette-raised flex cursor-grab items-center gap-2 rounded-(--dk-radius) border border-palette-line",
                "bg-palette-base px-2.5 py-2 text-sm hover:bg-palette-soft data-dragging:opacity-50",
            )}
        >
            <Icon
                aria-hidden
                className="size-4 shrink-0 text-palette-accent/85"
            />
            {widget.title}
        </Dockable.DragSource>
    );
}

function TabContent({ tab }: { tab: TabOf<Types> }) {
    return <WidgetContent tab={tab} />;
}

/** The kit's tabset, with a hint in the empty canvas. */
function TabSet({ node }: { node: TabsetNode<Types> }) {
    return (
        <Dockable.TabSet
            node={node}
            className={cn(
                styles.tabset,
                "data-empty:border-dashed",
                // while any drag is over the layout the root carries data-dragging
                "in-data-dragging:outline-2 in-data-dragging:outline-offset-2 in-data-dragging:outline-palette-line in-data-dragging:outline-dashed",
            )}
        >
            <KitTabStrip tabset={node}>
                {(tab) => {
                    const Icon = widgetOf(tab)?.icon;
                    return (
                        <KitTabButton node={tab}>
                            {Icon ? (
                                <Icon
                                    aria-hidden
                                    className="size-3.5 shrink-0"
                                />
                            ) : null}
                            <span data-tab-label className={styles.tabLabel}>
                                {tab.data.name}
                            </span>
                        </KitTabButton>
                    );
                }}
            </KitTabStrip>
            <Dockable.TabSetContent
                // no panel covers an empty tabset, so its content area can show a hint
                render={(props, state) => (
                    <div {...props}>
                        {state.empty ? (
                            <div className="grid h-full place-content-center justify-items-center gap-2 p-4 text-center text-sm text-palette-accent/85">
                                <LayoutDashboard
                                    aria-hidden
                                    className="size-7"
                                />
                                <p>Drag charts and tables here.</p>
                            </div>
                        ) : null}
                    </div>
                )}
            />
        </Dockable.TabSet>
    );
}

export default function DashboardBuilder() {
    // the model is created once; Reset loads the empty layout into it
    const [initial] = useState(restore);
    const model = initial.model;
    const [restoreError, setRestoreError] = useState(initial.error);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (!saved) return;
        const timer = setTimeout(() => setSaved(false), 1500);
        return () => clearTimeout(timer);
    }, [saved]);

    const save = () => {
        try {
            window.localStorage.setItem(
                STORAGE_KEY,
                // the layout document (JSON v1): what createModel and layout.load read back
                JSON.stringify(model.toJSON()),
            );
            setSaved(true);
        } catch {
            // storage unavailable: nothing to save to
        }
    };
    const reset = () => {
        try {
            window.localStorage.removeItem(STORAGE_KEY);
        } catch {
            // storage unavailable
        }
        // the same model, a new state: the rules stay installed
        model.run("layout.load", { layout: EMPTY });
        setRestoreError(undefined);
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className={styles.toolbar}>
                <h2 className="text-sm font-semibold">Sales dashboard</h2>
                <div className="ms-auto flex gap-2">
                    <button
                        type="button"
                        className={styles.button}
                        onClick={reset}
                    >
                        <RotateCcw aria-hidden className="size-4" />
                        Reset
                    </button>
                    <button
                        type="button"
                        className={cn("palette-blue", styles.solidButton)}
                        onClick={save}
                    >
                        <Save aria-hidden className="size-4" />
                        {saved ? "Saved" : "Save layout"}
                    </button>
                </div>
            </div>
            {restoreError ? (
                <div
                    role="alert"
                    className="palette-danger border-b border-palette-line bg-palette-base px-3 py-2 text-sm text-palette-contrast"
                >
                    <p>{`The saved layout could not be restored: ${restoreError.message}`}</p>
                    {restoreError.issues.length > 0 ? (
                        <ul className="mt-1 list-disc ps-5 font-mono text-xs">
                            {restoreError.issues.slice(0, 5).map((issue) => (
                                <li key={issue}>{issue}</li>
                            ))}
                        </ul>
                    ) : null}
                </div>
            ) : null}
            <div className="flex min-h-0 flex-1">
                <aside
                    aria-label="Widget palette"
                    className="palette-surface flex w-48 shrink-0 flex-col gap-3 overflow-y-auto border-e border-palette-line bg-palette-base p-3"
                >
                    {GROUPS.map((group) => (
                        <section
                            key={group}
                            aria-labelledby={`palette-${group}`}
                        >
                            <h3
                                id={`palette-${group}`}
                                className="pb-1.5 text-xs font-semibold tracking-wide text-palette-accent/85 uppercase"
                            >
                                {group}
                            </h3>
                            <ul className="flex flex-col gap-1.5">
                                {WIDGETS.filter(
                                    (widget) => widget.group === group,
                                ).map((widget) => (
                                    <PaletteItem
                                        key={widget.component}
                                        model={model}
                                        widget={widget}
                                    />
                                ))}
                            </ul>
                        </section>
                    ))}
                    <p className="mt-auto text-xs text-palette-accent/85">
                        KPIs go in the strip on top; everything else goes below.
                    </p>
                </aside>
                <DockLayout
                    model={model}
                    renderContent={(tab) => <TabContent tab={tab} />}
                    renderTabSet={(tabset) => <TabSet node={tabset} />}
                />
            </div>
        </div>
    );
}

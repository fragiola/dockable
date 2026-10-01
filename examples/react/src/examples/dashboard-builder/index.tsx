"use client";

import {
    createModel,
    type LayoutJson,
    LayoutValidationError,
    type Middleware,
    type Model,
    type RowNode,
    type TabsetNode,
    veto,
} from "@fragiola/dockable";
import { Dockable, type RowSplitterProps } from "@fragiola/dockable-react";
import { LayoutDashboard, RotateCcw, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "#/lib/cn";
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
            <div className="palette-surface flex flex-wrap items-center gap-2 border-b border-palette-line bg-palette-base px-3 py-2 text-palette-contrast">
                <h2 className="text-sm font-semibold">Sales dashboard</h2>
                <div className="ms-auto flex gap-2">
                    <button
                        type="button"
                        className={cn(
                            "inline-flex h-8 items-center gap-1.5 rounded-md border border-palette-line bg-palette-base px-3 text-sm",
                            "text-palette-contrast outline-none hover:bg-palette-soft focus-visible:ring-2 focus-visible:ring-palette-ring",
                            "disabled:pointer-events-none disabled:opacity-50",
                        )}
                        onClick={reset}
                    >
                        <RotateCcw aria-hidden className="size-4" />
                        Reset
                    </button>
                    <button
                        type="button"
                        className={cn(
                            "palette-blue inline-flex h-8 items-center gap-1.5 rounded-md bg-palette-base px-3 text-sm font-medium text-palette-contrast",
                            "outline-none hover:bg-palette-base-hover focus-visible:ring-2 focus-visible:ring-palette-ring focus-visible:ring-offset-2",
                            "disabled:pointer-events-none disabled:opacity-50",
                        )}
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
                <div className="flex min-h-0 flex-1 flex-col p-(--dk-gap)">
                    <Dockable.Root
                        model={model}
                        className="palette-surface min-h-0 flex-1 bg-palette-base font-(family-name:--dk-font) text-palette-contrast"
                    >
                        <Dockable.Row<Types>
                            renderSplitter={(props) => <Splitter {...props} />}
                        >
                            {renderNode}
                        </Dockable.Row>
                        <Dockable.Panels<Types>>
                            {(tab) => (
                                <Dockable.Panel
                                    node={tab}
                                    // panels sit in a layer above the tabsets, whose overflow
                                    // cannot clip them: the panel repeats the tabset's inner
                                    // radius on its corners
                                    className="palette-raised overflow-auto rounded-b-[max(0px,calc(var(--dk-radius)-var(--dk-border)))] bg-palette-base bg-(image:--dk-panel-texture) text-palette-contrast"
                                >
                                    <WidgetContent tab={tab} />
                                </Dockable.Panel>
                            )}
                        </Dockable.Panels>
                        {/* Where a dragged widget would land (hidden where the rules refuse it).
                            Panels are portalled into the root after it, so it needs a stacking
                            order to paint above them. */}
                        <Dockable.DropIndicator
                            className={(state) =>
                                cn(
                                    "z-20 rounded-(--dk-radius) border-2 [border-style:var(--dk-indicator-style)] border-palette-base transition-[left,top,width,height]",
                                    state.kind === "edge"
                                        ? "palette-orange bg-palette-base/25"
                                        : "palette-blue bg-palette-base/20",
                                )
                            }
                            style={(state) => ({
                                transitionDuration: `${state.tabDragSpeed}s`,
                            })}
                        />
                    </Dockable.Root>
                </div>
            </div>
        </div>
    );
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

/** A row's child: a tabset, or a nested row rendered by this same function. */
function renderNode(node: TabsetNode<Types> | RowNode<Types>) {
    if (node.type === "row") {
        return (
            <Dockable.Row
                node={node}
                renderSplitter={(props) => <Splitter {...props} />}
            >
                {renderNode}
            </Dockable.Row>
        );
    }
    return <TabSet node={node} />;
}

/** A tabset: a card with the strip of tabs on top, and a hint in the empty canvas. */
function TabSet({ node }: { node: TabsetNode<Types> }) {
    return (
        <Dockable.TabSet
            node={node}
            className={cn(
                "palette-raised rounded-(--dk-radius) border-(length:--dk-border) border-palette-line bg-palette-base text-palette-contrast shadow-(--dk-shadow) data-active:border-(--dk-tabset-active-line)",
                "data-empty:border-dashed",
                // while any drag is over the layout the root carries data-dragging
                "in-data-dragging:outline-2 in-data-dragging:outline-offset-2 in-data-dragging:outline-palette-line in-data-dragging:outline-dashed",
            )}
        >
            <div className="flex min-h-(--dk-tab-height) items-stretch border-b border-palette-line">
                <Dockable.TabList<Types>
                    // the tabset's name from the layout ("KPI strip", "Canvas")
                    aria-label={node.data?.name || "Tabs"}
                    // the start padding is load-bearing: a tab flush with the tabset's edge could
                    // not take a drop before it (that edge is the tabset's side drop)
                    className="flex min-w-0 flex-1 items-end gap-(--dk-tab-gap) overflow-hidden bg-(--dk-strip-bg) ps-[max(0.25rem,var(--dk-strip-padding))] pt-[calc(var(--dk-strip-padding)/2)]"
                >
                    {(tab) => {
                        const Icon = widgetOf(tab)?.icon;
                        return (
                            <Dockable.Tab
                                node={tab}
                                className={cn(
                                    "group/tab relative flex h-(--dk-tab-height) max-w-60 shrink-0 cursor-pointer select-none items-center gap-1.5 px-3",
                                    "rounded-t-(--dk-tab-radius) font-(family-name:--dk-tab-font) text-(length:--dk-tab-size) text-palette-accent/85",
                                    "border-e-(length:--dk-tab-divider) border-palette-line outline-none transition-colors duration-(--dk-motion) hover:bg-palette-soft",
                                    "focus-visible:ring-2 focus-visible:ring-palette-ring focus-visible:ring-inset",
                                    "data-selected:bg-(--dk-tab-selected-bg) data-selected:text-(--dk-tab-selected-fg) data-dragging:opacity-40",
                                )}
                            >
                                {Icon ? (
                                    <Icon
                                        aria-hidden
                                        className="size-3.5 shrink-0"
                                    />
                                ) : null}
                                <span className="truncate">
                                    {tab.data.name}
                                </span>
                                {/* the active tabset's marker: `in-data-active:` reads the
                                    enclosing TabSet's data-active, `group-data-selected/tab:`
                                    this tab's */}
                                <span
                                    aria-hidden="true"
                                    className="palette-blue pointer-events-none absolute inset-x-2 bottom-0 hidden h-0.5 rounded-full bg-palette-base in-data-active:group-data-selected/tab:[display:var(--dk-tab-marker)]"
                                />
                            </Dockable.Tab>
                        );
                    }}
                </Dockable.TabList>
            </div>
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

/**
 * The bar between two children of a row: `--dk-splitter-size` thick (the engine measures it), with
 * a wider grab area (`::after`) and a grip for the themes that show one (`--dk-grip`).
 */
function Splitter(props: RowSplitterProps<Types>) {
    return (
        <Dockable.Splitter
            {...props}
            aria-label="Resize"
            className={cn(
                "group/splitter relative z-10 flex shrink-0 items-center justify-center bg-(--dk-splitter-bg) outline-none",
                "after:absolute after:transition-colors after:duration-(--dk-motion)",
                "hover:after:bg-palette-ring/30 data-dragging:after:bg-palette-ring/60 focus-visible:after:bg-palette-ring/60",
                // side by side: a vertical bar
                "data-[orientation=vertical]:w-(--dk-splitter-size) data-[orientation=vertical]:cursor-ew-resize",
                "data-[orientation=vertical]:after:inset-y-0 data-[orientation=vertical]:after:start-1/2",
                "data-[orientation=vertical]:after:w-(--dk-splitter-grab) data-[orientation=vertical]:after:-translate-x-1/2",
                "rtl:data-[orientation=vertical]:after:translate-x-1/2",
                // stacked: a horizontal bar
                "data-[orientation=horizontal]:h-(--dk-splitter-size) data-[orientation=horizontal]:cursor-ns-resize",
                "data-[orientation=horizontal]:after:inset-x-0 data-[orientation=horizontal]:after:top-1/2",
                "data-[orientation=horizontal]:after:h-(--dk-splitter-grab) data-[orientation=horizontal]:after:-translate-y-1/2",
            )}
        >
            <span
                aria-hidden="true"
                className={cn(
                    "pointer-events-none [display:var(--dk-grip)] rounded-full bg-palette-line",
                    "group-data-[orientation=vertical]/splitter:h-8 group-data-[orientation=vertical]/splitter:w-1",
                    "group-data-[orientation=horizontal]/splitter:h-1 group-data-[orientation=horizontal]/splitter:w-8",
                )}
            />
        </Dockable.Splitter>
    );
}

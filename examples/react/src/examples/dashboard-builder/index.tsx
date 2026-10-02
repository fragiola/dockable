"use client";

import {
    createModel,
    Dockable,
    type LayoutJson,
    LayoutValidationError,
    type Middleware,
    type Model,
    type RowNode,
    type RowSplitterProps,
    type TabsetNode,
    veto,
} from "@fragiola/dockable-react";
import { LayoutDashboard, RotateCcw, Save } from "lucide-react";
import { useEffect, useState } from "react";
import * as styles from "./styles";
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
                JSON.stringify(model.get("layout-json")),
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
        <div className={styles.page}>
            <div className={styles.toolbar}>
                <h2 className={styles.title}>Sales dashboard</h2>
                <div className={styles.actions}>
                    <button
                        type="button"
                        className={styles.button}
                        onClick={reset}
                    >
                        <RotateCcw aria-hidden className={styles.buttonIcon} />
                        Reset
                    </button>
                    <button
                        type="button"
                        className={styles.primaryButton}
                        onClick={save}
                    >
                        <Save aria-hidden className={styles.buttonIcon} />
                        {saved ? "Saved" : "Save layout"}
                    </button>
                </div>
            </div>
            {restoreError ? (
                <div role="alert" className={styles.alert}>
                    <p>{`The saved layout could not be restored: ${restoreError.message}`}</p>
                    {restoreError.issues.length > 0 ? (
                        <ul className={styles.issues}>
                            {restoreError.issues.slice(0, 5).map((issue) => (
                                <li key={issue}>{issue}</li>
                            ))}
                        </ul>
                    ) : null}
                </div>
            ) : null}
            <div className={styles.body}>
                <aside
                    aria-label="Widget palette"
                    className={styles.widgetPalette}
                >
                    {GROUPS.map((group) => (
                        <section
                            key={group}
                            aria-labelledby={`palette-${group}`}
                        >
                            <h3
                                id={`palette-${group}`}
                                className={styles.groupTitle}
                            >
                                {group}
                            </h3>
                            <ul className={styles.groupList}>
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
                    <p className={styles.paletteHint}>
                        KPIs go in the strip on top; everything else goes below.
                    </p>
                </aside>
                <div className={styles.frame}>
                    <Dockable.Root model={model} className={styles.root}>
                        <Dockable.Row<Types>
                            renderSplitter={(props) => <Splitter {...props} />}
                        >
                            {renderNode}
                        </Dockable.Row>
                        <Dockable.Panels<Types>>
                            {(tab) => (
                                <Dockable.Panel
                                    node={tab}
                                    className={styles.panel}
                                >
                                    <WidgetContent tab={tab} />
                                </Dockable.Panel>
                            )}
                        </Dockable.Panels>
                        {/* Where a dragged widget would land (hidden where the rules refuse it). */}
                        <Dockable.DropIndicator
                            className={styles.dropIndicator}
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
            className={styles.paletteItem}
        >
            <Icon aria-hidden className={styles.paletteItemIcon} />
            {widget.title}
        </Dockable.DragSource>
    );
}

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
        <Dockable.TabSet node={node} className={styles.tabset}>
            <div className={styles.strip}>
                <Dockable.TabList<Types>
                    // the tabset's name from the layout ("KPI strip", "Canvas")
                    aria-label={node.data?.name || "Tabs"}
                    className={styles.tabList}
                >
                    {(tab) => {
                        const Icon = widgetOf(tab)?.icon;
                        return (
                            <Dockable.Tab node={tab} className={styles.tab}>
                                {Icon ? (
                                    <Icon
                                        aria-hidden
                                        className={styles.tabIcon}
                                    />
                                ) : null}
                                <span className={styles.tabName}>
                                    {tab.label}
                                </span>
                                <span
                                    aria-hidden="true"
                                    className={styles.tabMarker}
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
                            <div className={styles.emptyHint}>
                                <LayoutDashboard
                                    aria-hidden
                                    className={styles.emptyHintIcon}
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

function Splitter(props: RowSplitterProps<Types>) {
    return (
        <Dockable.Splitter
            {...props}
            aria-label="Resize"
            className={styles.splitter}
        >
            <span aria-hidden="true" className={styles.splitterGrip} />
        </Dockable.Splitter>
    );
}

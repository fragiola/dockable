"use client";

import {
    DockLocation,
    type IJsonModel,
    Model,
    type TabNode,
    type TabSetNode,
} from "@fragiola/dockable";
import { Dockable } from "@fragiola/dockable-react";
import { LayoutDashboard, RotateCcw, Save } from "lucide-react";
import { type Ref, useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { DockLayout } from "../_kit/layout";
import * as styles from "../_kit/styles";
import { KitTabButton, KitTabStrip } from "../_kit/tab-strip";
import {
    GROUPS,
    isKpi,
    WIDGETS,
    type Widget,
    WidgetContent,
    widgetOf,
    widgetTab,
} from "./widgets";

const STORAGE_KEY = "dockable-examples:dashboard-builder";

/** A KPI strip on top (it only takes KPIs), and an empty canvas for everything else. */
const EMPTY: IJsonModel = {
    global: { tabSetEnableDeleteWhenEmpty: false },
    borders: [],
    layout: {
        type: "row",
        children: [
            {
                type: "row",
                children: [
                    {
                        type: "tabset",
                        id: "kpis",
                        name: "KPI strip",
                        weight: 30,
                        minHeight: 130,
                        children: [
                            {
                                type: "tab",
                                name: "Revenue",
                                component: "kpi-revenue",
                            },
                        ],
                    },
                    {
                        type: "tabset",
                        id: "canvas",
                        name: "Canvas",
                        weight: 70,
                        children: [],
                    },
                ],
            },
        ],
    },
};

function load(): Model {
    try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) return Model.fromJson(JSON.parse(saved) as IJsonModel);
    } catch {
        // no storage, or a layout saved by an older version: start empty
    }
    return Model.fromJson(EMPTY);
}

/**
 * The drop rules, on the model: KPIs only into the centre of the KPI strip, and nothing else into
 * it (nor beside it). They apply to widgets dragged from the palette and to tabs moved inside the
 * layout alike: a refused target shows no drop indicator.
 */
function withRules(model: Model): Model {
    model.setOnAllowDrop((dragNode, dropInfo) => {
        const intoKpis = dropInfo.node.getId() === "kpis";
        if (isKpi(dragNode)) {
            return intoKpis && dropInfo.location === DockLocation.CENTER;
        }
        return !intoKpis;
    });
    return model;
}

function PaletteItem({ model, widget }: { model: Model; widget: Widget }) {
    const Icon = widget.icon;
    return (
        <Dockable.DragSource
            model={model}
            json={() => widgetTab(widget)}
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

function TabContent({ tab }: { tab: TabNode }) {
    return <WidgetContent tab={tab} />;
}

/** The kit's tabset, with a hint in the empty canvas. */
function TabSet({ node }: { node: TabSetNode }) {
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
                                {tab.getName()}
                            </span>
                        </KitTabButton>
                    );
                }}
            </KitTabStrip>
            <Dockable.TabSetContent
                // no panel covers an empty tabset, so its content area can show a hint
                render={(props, state) => (
                    <div {...props} ref={props.ref as Ref<HTMLDivElement>}>
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
    const [model, setModel] = useState(() => withRules(load()));
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
                JSON.stringify(model.toJson()),
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
        // a new model is a new layout: Dockable.Root creates a new engine for it
        setModel(withRules(Model.fromJson(EMPTY)));
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

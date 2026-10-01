"use client";

import {
    type ComponentOf,
    MAIN_LAYOUT,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable";
import { Dockable, useDockable } from "@fragiola/dockable-react";
import {
    ChartLine,
    ExternalLink,
    Gauge,
    type LucideIcon,
    Maximize2,
    Minimize2,
    PanelTopClose,
    Sheet,
    TriangleAlert,
    X,
} from "lucide-react";
import { cn } from "#/lib/cn";
import type { Types } from "./data";

// How the dashboard decorates its tabsets: an icon per widget type, a red tab for a KPI below
// target, a close button, and maximize / pop out / dock back buttons in the header.

/** A KPI below its target: its tab takes the danger palette and a warning icon. */
export function isAlert(tab: TabOf<Types>) {
    return tab.component === "kpi" && tab.data.status === "alert";
}

const ICONS: Record<ComponentOf<Types>, LucideIcon> = {
    chart: ChartLine,
    table: Sheet,
    kpi: Gauge,
};

/** What goes inside each tab button: the widget's icon (or a warning), its name, a close button. */
export function TabContent({ tab }: { tab: TabOf<Types> }) {
    const { model } = useDockable<Types>();
    const Icon = ICONS[tab.component];
    const alert = isAlert(tab);
    return (
        <>
            {alert ? (
                <TriangleAlert
                    role="img"
                    aria-label="Below target"
                    className="size-3.5 shrink-0"
                />
            ) : (
                <Icon aria-hidden="true" className="size-3.5 shrink-0" />
            )}
            <span className="truncate">{tab.data.name}</span>
            <button
                type="button"
                tabIndex={-1}
                draggable={false}
                aria-label={`Close ${tab.data.name}`}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                    event.stopPropagation();
                    model.run("tab.close", { tabId: tab.id });
                }}
                className={cn(
                    "-me-1.5 grid size-6 shrink-0 place-items-center self-center rounded-sm text-palette-accent/85 opacity-0",
                    "outline-none hover:bg-palette-soft hover:text-palette-contrast focus-visible:ring-2 focus-visible:ring-palette-ring",
                    "group-hover/tab:opacity-100 group-data-selected/tab:opacity-100",
                )}
            >
                <X aria-hidden="true" className="size-3" />
            </button>
        </>
    );
}

/** The tabset's header buttons: maximize, and pop out (or dock back when already popped out). */
export function TabSetButtons({ tabset }: { tabset: TabsetNode<Types> }) {
    const { model } = useDockable<Types>();
    const selected = model.get("selected-tab-by", {
        tabsetId: tabset.id,
    });
    const inPopout =
        model.get("layout-id-by", { nodeId: tabset.id }) !== MAIN_LAYOUT;
    const maximized = model.get("maximized-tabset")?.id === tabset.id;

    // one trigger both ways: it pops the selected tab out, and in the window docks it back
    const popoutTrigger = selected ? (
        <Dockable.PopoutTrigger
            aria-label={
                inPopout
                    ? `Dock ${selected.data.name} back`
                    : `Pop out ${selected.data.name}`
            }
            data-testid={inPopout ? "dock-back" : "popout"}
            className={cn(
                "grid size-6 shrink-0 place-items-center self-center rounded-sm text-palette-accent/85",
                "outline-none hover:bg-palette-soft hover:text-palette-contrast focus-visible:ring-2 focus-visible:ring-palette-ring",
                "disabled:pointer-events-none disabled:opacity-40",
            )}
        >
            {inPopout ? (
                <PanelTopClose aria-hidden="true" className="size-4" />
            ) : (
                <ExternalLink aria-hidden="true" className="size-3.5" />
            )}
        </Dockable.PopoutTrigger>
    ) : null;

    if (inPopout) {
        return popoutTrigger;
    }
    return (
        <>
            {popoutTrigger}
            <button
                type="button"
                aria-label={maximized ? "Restore" : "Maximize"}
                aria-pressed={maximized}
                data-testid="maximize"
                onClick={() =>
                    model.run("tabset.maximize", {
                        tabsetId: tabset.id,
                        value: !maximized,
                    })
                }
                className={cn(
                    "grid size-6 shrink-0 place-items-center self-center rounded-sm text-palette-accent/85",
                    "outline-none hover:bg-palette-soft hover:text-palette-contrast focus-visible:ring-2 focus-visible:ring-palette-ring",
                    "disabled:pointer-events-none disabled:opacity-40",
                )}
            >
                {maximized ? (
                    <Minimize2 aria-hidden="true" className="size-3.5" />
                ) : (
                    <Maximize2 aria-hidden="true" className="size-3.5" />
                )}
            </button>
        </>
    );
}

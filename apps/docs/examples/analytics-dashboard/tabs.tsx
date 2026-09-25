"use client";

import {
    Actions,
    DockableLabel,
    DockLocation,
    Model,
    type TabNode,
    type TabSetNode,
} from "@fragiola/dockable";
import { useDockable } from "@fragiola/dockable-react";
import {
    ChartLine,
    ExternalLink,
    Gauge,
    Maximize2,
    Minimize2,
    PanelTopClose,
    Sheet,
    TriangleAlert,
    X,
} from "lucide-react";
import { label } from "../_kit/labels";
import * as styles from "../_kit/styles";
import type { KpiConfig } from "./widgets";

// How the dashboard decorates the kit's tabsets: an icon per widget type, a red tab for a KPI
// below target, a close button, and maximize / pop out / dock back buttons in the header.

function isAlert(tab: TabNode) {
    return (tab.getConfig() as KpiConfig | undefined)?.status === "alert";
}

/** The kit's `tabClassName`: a KPI tab below target takes the danger palette. */
export function tabClassName(tab: TabNode) {
    return isAlert(tab)
        ? "palette-danger text-palette-accent data-selected:text-palette-accent"
        : "";
}

const ICONS = { chart: ChartLine, table: Sheet, kpi: Gauge };

/** The kit's `renderTab`: what goes inside each tab button. */
export function TabContent({ tab }: { tab: TabNode }) {
    const { engine } = useDockable();
    const Icon = ICONS[tab.getComponent() as keyof typeof ICONS] ?? ChartLine;
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
            <span data-tab-label className={styles.tabLabel}>
                {tab.getName()}
            </span>
            <button
                type="button"
                tabIndex={-1}
                draggable={false}
                aria-label={`${label(DockableLabel.Close_Tab)} ${tab.getName()}`}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                    event.stopPropagation();
                    engine.doAction(Actions.deleteTab(tab.getId()));
                }}
                className={`${styles.iconButton} -me-1.5 size-5 opacity-0 group-hover/tab:opacity-100 group-data-selected/tab:opacity-100`}
            >
                <X aria-hidden="true" className="size-3" />
            </button>
        </>
    );
}

/** The kit's `renderActions`: maximize, and pop out (or dock back when already popped out). */
export function TabSetActions({ tabset }: { tabset: TabSetNode }) {
    const { engine, mainEngine, model } = useDockable();
    const selected = tabset.getSelectedNode() as TabNode | undefined;
    const inPopout = tabset.getLayoutId() !== Model.MAIN_LAYOUT_ID;
    const maximized = tabset.isMaximized();

    const dockBack = () => {
        const target = model.getFirstTabSet();
        if (selected && target) {
            mainEngine.doAction(
                Actions.moveNode(
                    selected.getId(),
                    target.getId(),
                    DockLocation.CENTER,
                    -1,
                ),
            );
        }
    };

    if (inPopout) {
        return selected ? (
            <button
                type="button"
                aria-label={`Dock ${selected.getName()} back`}
                data-testid="dock-back"
                onClick={dockBack}
                className={styles.iconButton}
            >
                <PanelTopClose aria-hidden="true" className="size-4" />
            </button>
        ) : null;
    }
    return (
        <>
            {selected?.isEnablePopout() && mainEngine.isSupportsPopout() ? (
                <button
                    type="button"
                    aria-label={`${label(DockableLabel.Popout_Tab)} ${selected.getName()}`}
                    data-testid="popout"
                    onClick={() =>
                        engine.doAction(
                            Actions.popoutTab(selected.getId(), "window"),
                        )
                    }
                    className={styles.iconButton}
                >
                    <ExternalLink aria-hidden="true" className="size-3.5" />
                </button>
            ) : null}
            <button
                type="button"
                aria-label={label(
                    maximized ? DockableLabel.Restore : DockableLabel.Maximize,
                )}
                aria-pressed={maximized}
                data-testid="maximize"
                onClick={() =>
                    engine.doAction(Actions.maximizeToggle(tabset.getId()))
                }
                className={styles.iconButton}
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

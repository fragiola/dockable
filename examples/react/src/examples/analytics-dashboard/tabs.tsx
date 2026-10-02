"use client";

import type { ComponentOf, TabOf, TabsetNode } from "@fragiola/dockable";
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
import type { Types } from "./data";
import * as styles from "./styles";

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
                    className={styles.tabIcon}
                />
            ) : (
                <Icon aria-hidden="true" className={styles.tabIcon} />
            )}
            <span className={styles.tabName}>{tab.label}</span>
            <button
                type="button"
                tabIndex={-1}
                draggable={false}
                aria-label={`Close ${tab.label}`}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                    event.stopPropagation();
                    model.run("tab.close", { tabId: tab.id });
                }}
                className={styles.tabClose}
            >
                <X aria-hidden="true" className={styles.tabCloseIcon} />
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
    const inPopout = model.is("node-in-window", { nodeId: tabset.id });
    const maximized = model.is("tabset-maximized", { tabsetId: tabset.id });

    // one trigger both ways: it pops the selected tab out, and in the window docks it back
    const popoutTrigger = selected ? (
        <Dockable.PopoutTrigger
            aria-label={
                inPopout
                    ? `Dock ${selected.label} back`
                    : `Pop out ${selected.label}`
            }
            data-testid={inPopout ? "dock-back" : "popout"}
            className={styles.button}
        >
            {inPopout ? (
                <PanelTopClose
                    aria-hidden="true"
                    className={styles.dockBackIcon}
                />
            ) : (
                <ExternalLink
                    aria-hidden="true"
                    className={styles.buttonIcon}
                />
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
                className={styles.button}
            >
                {maximized ? (
                    <Minimize2
                        aria-hidden="true"
                        className={styles.buttonIcon}
                    />
                ) : (
                    <Maximize2
                        aria-hidden="true"
                        className={styles.buttonIcon}
                    />
                )}
            </button>
        </>
    );
}

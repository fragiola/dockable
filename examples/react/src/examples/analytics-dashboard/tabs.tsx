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
                // the tab is the tab stop: Ctrl+Delete on it closes it from the keyboard
                tabIndex={-1}
                aria-label={`Close ${tab.label}`}
                className={styles.tabClose}
                onClick={(event) => {
                    event.stopPropagation(); // a click on the tab would select it
                    model.run("tab.close", { tabId: tab.id });
                }}
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
            className={styles.button}
            render={(props, state) =>
                state.mode === "dock" ? (
                    <button
                        {...props}
                        aria-label={`Dock ${selected.label} back`}
                        data-testid="dock-back"
                    >
                        <PanelTopClose
                            aria-hidden="true"
                            className={styles.dockBackIcon}
                        />
                    </button>
                ) : (
                    <button
                        {...props}
                        aria-label={`Pop out ${selected.label}`}
                        data-testid="popout"
                    >
                        <ExternalLink
                            aria-hidden="true"
                            className={styles.buttonIcon}
                        />
                    </button>
                )
            }
        />
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

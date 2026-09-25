"use client";

import type { TabNode, TabSetNode } from "@fragiola/dockable";
import { Dockable, type TabProps } from "@fragiola/dockable-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import * as styles from "./styles";

/**
 * The kit's tabset, in parts, for examples that write their own `Dockable.TabSet` (to put the
 * strip below the content, wrap each tab in a tooltip, handle a middle click, show a hint in an
 * empty tabset, …). `KitTabSet` in `layout.tsx` is these parts in the default order.
 */

/** A kit-styled `Dockable.Tab` that forwards every prop (handlers, `render`, `ref`, …). */
export function KitTabButton({
    node,
    className,
    children,
    ...rest
}: Omit<TabProps, "className"> & { className?: string | undefined }) {
    return (
        <Dockable.Tab
            node={node}
            data-kit-tab=""
            className={cn(styles.tab, className)}
            {...rest}
        >
            {children ?? (
                <span data-tab-label className={styles.tabLabel}>
                    {node.getName()}
                </span>
            )}
            <span
                aria-hidden="true"
                data-tab-marker
                className={styles.tabMarker}
            />
        </Dockable.Tab>
    );
}

/** The strip row: a `Dockable.TabList` calling `children` per tab, and the tabset's buttons. */
export function KitTabStrip({
    tabset,
    children,
    actions,
    className,
}: {
    tabset: TabSetNode;
    /** renders a tab: a `Dockable.Tab` (or `KitTabButton`) */
    children: (tab: TabNode) => ReactNode;
    /** buttons at the end of the strip */
    actions?: ReactNode;
    className?: string | undefined;
}) {
    return (
        <div className={cn(styles.tabsetHeader, className)}>
            <Dockable.TabList
                aria-label={tabset.getName() ?? "Tabs"}
                className={styles.tabList}
            >
                {children}
            </Dockable.TabList>
            {actions ? (
                <div className={styles.tabsetActions}>{actions}</div>
            ) : null}
        </div>
    );
}

"use client";

import type { TabNode, TabSetNode } from "@fragiola/dockable";
import { Dockable } from "@fragiola/dockable-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { RenderNodeOptions, TabSetOptions } from "./layout";
import * as styles from "./styles";

/**
 * For examples that own the tab element itself: a `data-*` of their own on it, a handler on the
 * whole tab, or a `render` prop that turns it into a menu trigger. `KitTabSet` always renders a
 * `KitTab`, so this is its twin with one more hook: the example returns the `Dockable.Tab` (with
 * `data-kit-tab=""`, the marker the themes' flourishes key on).
 */
export type RenderTabElement = (tab: TabNode) => ReactNode;

/** The inside of a kit tab: its label (or `children`) and the active-tabset marker. */
export function TabParts({
    tab,
    children,
}: {
    tab: TabNode;
    children?: ReactNode;
}) {
    return (
        <>
            {children ?? (
                <span data-tab-label className={styles.tabLabel}>
                    {tab.getName()}
                </span>
            )}
            <span
                aria-hidden="true"
                data-tab-marker
                className={styles.tabMarker}
            />
        </>
    );
}

/** `styles.tabset` without its palette, for examples that pick the tabset's palette themselves. */
export const tabsetShape = styles.tabset.replace("palette-raised ", "");

/** The kit's tabset (header, tab list, actions, content area) with tabs the example renders. */
export function CustomTabSet({
    node,
    options = {},
    renderTabElement,
    className,
}: {
    node: TabSetNode;
    options?: TabSetOptions | undefined;
    renderTabElement: RenderTabElement;
    /** replaces `styles.tabset` (and `tabsetClassName`) when given */
    className?: string | undefined;
}) {
    const header = (
        <div className={styles.tabsetHeader}>
            <Dockable.TabList
                aria-label={node.getName() ?? "Tabs"}
                data-kit-tablist=""
                className={styles.tabList}
            >
                {renderTabElement}
            </Dockable.TabList>
            {options.renderActions ? (
                <div className={styles.tabsetActions}>
                    {options.renderActions(node)}
                </div>
            ) : null}
        </div>
    );
    const strip = options.renderHeader
        ? options.renderHeader(node, header)
        : header;
    const extra =
        typeof options.tabsetClassName === "function"
            ? options.tabsetClassName(node)
            : options.tabsetClassName;
    return (
        <Dockable.TabSet
            node={node}
            data-kit-tabset=""
            className={className ?? cn(styles.tabset, extra)}
        >
            {options.stripAtBottom ? null : strip}
            <Dockable.TabSetContent />
            {options.stripAtBottom ? strip : null}
        </Dockable.TabSet>
    );
}

/** A `renderTabSet` for `DockLayout` whose tabs are rendered by `renderTabElement`. */
export function withTabElement(
    renderTabElement: RenderTabElement,
): NonNullable<RenderNodeOptions["renderTabSet"]> {
    return (tabset, options) => (
        <CustomTabSet
            node={tabset}
            options={options}
            renderTabElement={renderTabElement}
        />
    );
}

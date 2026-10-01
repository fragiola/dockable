"use client";

import type {
    AnyTypes,
    BorderNode,
    DockableTypes,
    Model,
    RowNode,
    TabOf,
    TabsetNode,
} from "@fragiola/dockable";
import {
    Dockable,
    type RootProps,
    type RowSplitterProps,
} from "@fragiola/dockable-react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "#/lib/cn";
import { labels } from "./labels";
import * as styles from "./styles";

/**
 * The example kit: the recursion every Dockable layout writes once (Row › TabSet › TabList ›
 * Tab, TabSetContent, nested Rows), styled with `styles.ts`, plus the panel layer, the drop
 * indicator and popouts. Examples override only what they are about, through the props below.
 * The whole file is plain Dockable primitives: copy it and change anything.
 *
 * Every part is generic over the example's registry `T` (its `Types`), so the functions an example
 * passes get typed tabs: `renderContent={(tab) => …}` narrows `tab.data` on `tab.component`.
 */

/**
 * The kit's label for a tab or tabset: its `data.name` when it has one. The examples keep each
 * tab's name in its data; this reads it from any registry without a cast.
 */
export function tabName(node: { readonly data?: unknown }): string {
    const data = node.data;
    return typeof data === "object" &&
        data !== null &&
        "name" in data &&
        typeof data.name === "string"
        ? data.name
        : "";
}

/** Renders what goes inside a `Dockable.Tab` (default: the tab's name). */
export type RenderTab<T extends DockableTypes = AnyTypes> = (
    tab: TabOf<T>,
) => ReactNode;

export interface TabSetOptions<T extends DockableTypes = AnyTypes> {
    /** the content of each tab button */
    renderTab?: RenderTab<T> | undefined;
    /** extra class names for each tab button */
    tabClassName?: string | ((tab: TabOf<T>) => string) | undefined;
    /** buttons at the end of the tabset's header (close tabset, maximize, …) */
    renderActions?: ((tabset: TabsetNode<T>) => ReactNode) | undefined;
    /** replaces the whole header (strip and buttons); receives the default one */
    renderHeader?:
        | ((tabset: TabsetNode<T>, header: ReactNode) => ReactNode)
        | undefined;
    /** extra class names for each tabset */
    tabsetClassName?: string | ((tabset: TabsetNode<T>) => string) | undefined;
    /** put the strip below the content */
    stripAtBottom?: boolean | undefined;
}

/** The kit's splitter: the themed bar with an optional grip, named "Resize". */
export function KitSplitter<T extends DockableTypes = AnyTypes>(
    props: RowSplitterProps<T> & { className?: string },
) {
    const { className, ...rest } = props;
    return (
        <Dockable.Splitter
            aria-label={labels.splitter}
            {...rest}
            className={cn(styles.splitter, className)}
        >
            <span aria-hidden="true" className={styles.splitterGrip} />
        </Dockable.Splitter>
    );
}

/** The kit's tab button. */
export function KitTab<T extends DockableTypes = AnyTypes>({
    node,
    className,
    children,
}: {
    node: TabOf<T>;
    className?: string | undefined;
    children?: ReactNode;
}) {
    return (
        <Dockable.Tab
            node={node}
            data-kit-tab=""
            className={cn(styles.tab, className)}
        >
            {children ?? (
                <span data-tab-label className={styles.tabLabel}>
                    {tabName(node)}
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

function resolve<T>(
    value: string | ((node: T) => string) | undefined,
    node: T,
): string | undefined {
    return typeof value === "function" ? value(node) : value;
}

/** The kit's tabset: a header (tab list and buttons) and the measured content area. */
export function KitTabSet<T extends DockableTypes = AnyTypes>({
    node,
    options = {},
}: {
    node: TabsetNode<T>;
    options?: TabSetOptions<T> | undefined;
}) {
    const header = (
        <div className={styles.tabsetHeader}>
            <Dockable.TabList<T>
                aria-label={tabName(node) || "Tabs"}
                data-kit-tablist=""
                className={styles.tabList}
            >
                {(tab) => (
                    <KitTab
                        node={tab}
                        className={resolve(options.tabClassName, tab)}
                    >
                        {options.renderTab?.(tab)}
                    </KitTab>
                )}
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
    return (
        <Dockable.TabSet
            node={node}
            data-kit-tabset=""
            className={cn(
                styles.tabset,
                resolve(options.tabsetClassName, node),
            )}
        >
            {options.stripAtBottom ? null : strip}
            <Dockable.TabSetContent />
            {options.stripAtBottom ? strip : null}
        </Dockable.TabSet>
    );
}

export interface RenderNodeOptions<T extends DockableTypes = AnyTypes>
    extends TabSetOptions<T> {
    /** the splitter between two children of a row */
    renderSplitter?: ((props: RowSplitterProps<T>) => ReactNode) | undefined;
    /** replaces the tabset renderer entirely */
    renderTabSet?:
        | ((tabset: TabsetNode<T>, options: TabSetOptions<T>) => ReactNode)
        | undefined;
}

/**
 * Builds the recursive child function for `Dockable.Row`: a tabset, or a nested row rendered by
 * the same function. The developer owns this recursion; the kit only writes it once.
 */
export function createRenderNode<T extends DockableTypes = AnyTypes>(
    options: RenderNodeOptions<T> = {},
) {
    const renderSplitter =
        options.renderSplitter ??
        ((props: RowSplitterProps<T>) => <KitSplitter {...props} />);
    const renderNode = (child: TabsetNode<T> | RowNode<T>): ReactNode => {
        if (child.type === "tabset") {
            return options.renderTabSet ? (
                options.renderTabSet(child, options)
            ) : (
                <KitTabSet node={child} options={options} />
            );
        }
        return (
            <Dockable.Row node={child} renderSplitter={renderSplitter}>
                {renderNode}
            </Dockable.Row>
        );
    };
    return { renderNode, renderSplitter };
}

/** Renders what goes inside a border's `Dockable.Tab` (default: the tab's name). */
export type RenderBorderTab<T extends DockableTypes = AnyTypes> = (
    tab: TabOf<T>,
) => ReactNode;

/** How a border's strip and tabs look, per example (the kit's default: vertical side labels). */
export interface BorderOptions<T extends DockableTypes = AnyTypes> {
    /** the content of a border's tab button (default: the tab's name) */
    renderBorderTab?: RenderBorderTab<T> | undefined;
    /**
     * classes for a border's tab, replacing the kit's vertical side labels
     * (`styles.borderTabVertical`) when given: upright labels, icon-only tabs
     */
    borderTabClassName?:
        | string
        | ((tab: TabOf<T>) => string | undefined)
        | undefined;
    /** an accessible name for a border's tab, when its content has no text (an icon) */
    borderTabLabel?: ((tab: TabOf<T>) => string | undefined) | undefined;
    /** extra classes for a border's strip (its width, say) */
    borderClassName?:
        | string
        | ((border: BorderNode<T>) => string | undefined)
        | undefined;
    /** a left border's tab direction (`data-tab-direction` on its strip) */
    tabDirection?: "up" | "down" | undefined;
}

/** The kit's border strip: a `Dockable.Border` with its tab list. */
export function KitBorder<T extends DockableTypes = AnyTypes>({
    node,
    options = {},
}: {
    node: BorderNode<T>;
    options?: BorderOptions<T> | undefined;
}) {
    const tabClass = (tab: TabOf<T>) =>
        typeof options.borderTabClassName === "function"
            ? options.borderTabClassName(tab)
            : options.borderTabClassName;
    return (
        <Dockable.Border
            node={node}
            tabDirection={options.tabDirection}
            className={cn(
                styles.border,
                typeof options.borderClassName === "function"
                    ? options.borderClassName(node)
                    : options.borderClassName,
            )}
        >
            <Dockable.TabList<T>
                aria-label={`${node.location} panels`}
                className={styles.borderTabList}
            >
                {(tab) => (
                    <Dockable.Tab
                        node={tab}
                        aria-label={options.borderTabLabel?.(tab)}
                        className={cn(
                            styles.borderTab,
                            tabClass(tab) ?? styles.borderTabVertical,
                        )}
                    >
                        {options.renderBorderTab
                            ? options.renderBorderTab(tab)
                            : tabName(tab)}
                    </Dockable.Tab>
                )}
            </Dockable.TabList>
        </Dockable.Border>
    );
}

/** The kit's border panel area, with the kit's splitter on the layout's side of it. */
export function KitBorderContent<T extends DockableTypes = AnyTypes>({
    node,
}: {
    node: BorderNode<T>;
}) {
    return (
        <Dockable.BorderContent
            node={node}
            className={styles.borderContent}
            renderSplitter={(border) => (
                <Dockable.Splitter
                    node={border}
                    aria-label={labels.splitter}
                    className={styles.splitter}
                >
                    <span aria-hidden="true" className={styles.splitterGrip} />
                </Dockable.Splitter>
            )}
        />
    );
}

const EDGES = [
    ["top", ArrowUp],
    ["bottom", ArrowDown],
    ["left", ArrowLeft],
    ["right", ArrowRight],
] as const;

/** The four edge indicators, each with an arrow pointing at its edge. */
export function KitEdgeIndicators() {
    return (
        <>
            {EDGES.map(([edge, Arrow]) => (
                <Dockable.EdgeIndicator
                    key={edge}
                    edge={edge}
                    className={styles.edgeIndicator}
                >
                    <Arrow aria-hidden="true" className="size-3" />
                </Dockable.EdgeIndicator>
            ))}
        </>
    );
}

/** The popout host page, served next to the app under its base (Vite's `BASE_URL`). */
export const popoutURL = `${import.meta.env.BASE_URL}popout.html`;

export interface DockLayoutProps<T extends DockableTypes = AnyTypes>
    extends RenderNodeOptions<T> {
    /**
     * the model. Its policies are middleware (`model.use`) and its reactions listeners
     * (`model.subscribe`): the layout itself takes neither
     */
    model: Model<T>;
    /** the content of a tab's panel: `tab.data` narrows on `tab.component` */
    renderContent: (tab: TabOf<T>) => ReactNode;
    /** extra class names for each panel */
    panelClassName?: string | ((tab: TabOf<T>) => string) | undefined;
    /** render a tab's content only once it is first shown (default true) */
    renderOnDemand?: boolean | ((tab: TabOf<T>) => boolean) | undefined;
    /** extra class names for the root */
    className?: string | undefined;
    /** more props for `Dockable.Root` */
    rootProps?: Partial<Omit<RootProps<T>, "model">> | undefined;
    /** extra elements inside the root (overlays, effects that need `useDockable`) */
    children?: ReactNode;
    /** how the model's borders look (see `BorderOptions`) */
    borders?: BorderOptions<T> | undefined;
    /** show the edge docking targets (`Dockable.EdgeIndicator`) during a drag */
    edgeIndicators?: boolean | undefined;
}

/**
 * A complete themed layout: `Dockable.Root` with the kit's recursion, the borders of the model
 * around it, the panel layer, the drop indicator and popout windows.
 */
export function DockLayout<T extends DockableTypes = AnyTypes>(
    props: DockLayoutProps<T>,
) {
    const {
        model,
        renderContent,
        panelClassName,
        renderOnDemand,
        className,
        rootProps,
        children,
        borders,
        edgeIndicators,
        ...options
    } = props;
    const { renderNode, renderSplitter } = createRenderNode(options);

    return (
        <div className={styles.frame}>
            <Dockable.Root
                model={model}
                popoutURL={popoutURL}
                // <html> and <body>'s attributes (light/dark, the example theme) into each popout,
                // kept in sync
                popoutMirrorRoot
                className={cn(styles.root, className)}
                {...rootProps}
            >
                <Dockable.Borders<T>
                    renderBar={(border) => (
                        <KitBorder node={border} options={borders} />
                    )}
                    renderContent={(border) => (
                        <KitBorderContent node={border} />
                    )}
                >
                    <Dockable.Row<T> renderSplitter={renderSplitter}>
                        {renderNode}
                    </Dockable.Row>
                </Dockable.Borders>
                <Dockable.Panels<T> renderOnDemand={renderOnDemand}>
                    {(tab) => (
                        <Dockable.Panel
                            node={tab}
                            data-kit-panel=""
                            className={cn(
                                styles.panel,
                                resolve(panelClassName, tab),
                            )}
                        >
                            {renderContent(tab)}
                        </Dockable.Panel>
                    )}
                </Dockable.Panels>
                <Dockable.DropIndicator
                    className={styles.dropIndicator}
                    style={(state) => ({
                        transitionDuration: `${state.tabDragSpeed}s`,
                    })}
                />
                <Dockable.Popout<T> className={styles.root}>
                    {() => (
                        <>
                            <Dockable.Row<T> renderSplitter={renderSplitter}>
                                {renderNode}
                            </Dockable.Row>
                            {/* a window shows its own outline during a drag into it */}
                            <Dockable.DropIndicator
                                className={styles.dropIndicator}
                                style={(state) => ({
                                    transitionDuration: `${state.tabDragSpeed}s`,
                                })}
                            />
                        </>
                    )}
                </Dockable.Popout>
                {edgeIndicators ? <KitEdgeIndicators /> : null}
                {children}
            </Dockable.Root>
        </div>
    );
}

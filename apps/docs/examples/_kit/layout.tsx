"use client";

import {
    type BorderNode,
    type Model,
    type ModelLayout,
    type OnAction,
    type OnModelChange,
    RowNode,
    type TabNode,
    TabSetNode,
} from "@fragiola/dockable";
import {
    Dockable,
    type RootProps,
    type RowSplitterProps,
} from "@fragiola/dockable-react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { getLabel } from "./labels";
import * as styles from "./styles";

/**
 * The example kit: the recursion every Dockable layout writes once (Row › TabSet › TabList ›
 * Tab, TabSetContent, nested Rows), styled with `styles.ts`, plus the panel layer, the drop
 * indicator and popouts. Examples override only what they are about, through the props below.
 * The whole file is plain Dockable primitives: copy it and change anything.
 */

/** Renders what goes inside a `Dockable.Tab` (default: the tab's name). */
export type RenderTab = (tab: TabNode) => ReactNode;

export interface TabSetOptions {
    /** the content of each tab button */
    renderTab?: RenderTab | undefined;
    /** extra class names for each tab button */
    tabClassName?: string | ((tab: TabNode) => string) | undefined;
    /** buttons at the end of the tabset's header (close tabset, maximize, …) */
    renderActions?: ((tabset: TabSetNode) => ReactNode) | undefined;
    /** replaces the whole header (strip and buttons); receives the default one */
    renderHeader?:
        | ((tabset: TabSetNode, header: ReactNode) => ReactNode)
        | undefined;
    /** extra class names for each tabset */
    tabsetClassName?: string | ((tabset: TabSetNode) => string) | undefined;
    /** put the strip below the content */
    stripAtBottom?: boolean | undefined;
}

/** The kit's splitter: the themed bar with an optional grip. */
export function KitSplitter(props: RowSplitterProps & { className?: string }) {
    const { className, ...rest } = props;
    return (
        <Dockable.Splitter {...rest} className={cn(styles.splitter, className)}>
            <span aria-hidden="true" className={styles.splitterGrip} />
        </Dockable.Splitter>
    );
}

/** The kit's tab button. */
export function KitTab({
    node,
    className,
    children,
}: {
    node: TabNode;
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

function resolve<T>(
    value: string | ((node: T) => string) | undefined,
    node: T,
): string | undefined {
    return typeof value === "function" ? value(node) : value;
}

/** The kit's tabset: a header (tab list and buttons) and the measured content area. */
export function KitTabSet({
    node,
    options = {},
}: {
    node: TabSetNode;
    options?: TabSetOptions | undefined;
}) {
    const header = (
        <div className={styles.tabsetHeader}>
            <Dockable.TabList
                aria-label={node.getName() ?? "Tabs"}
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

export interface RenderNodeOptions extends TabSetOptions {
    /** the splitter between two children of a row */
    renderSplitter?: ((props: RowSplitterProps) => ReactNode) | undefined;
    /** replaces the tabset renderer entirely */
    renderTabSet?:
        | ((tabset: TabSetNode, options: TabSetOptions) => ReactNode)
        | undefined;
}

/**
 * Builds the recursive child function for `Dockable.Row`: a tabset, or a nested row rendered by
 * the same function. The developer owns this recursion; the kit only writes it once.
 */
export function createRenderNode(options: RenderNodeOptions = {}) {
    const renderSplitter =
        options.renderSplitter ?? ((props) => <KitSplitter {...props} />);
    const renderNode = (child: TabSetNode | RowNode): ReactNode => {
        if (child instanceof TabSetNode) {
            return options.renderTabSet ? (
                options.renderTabSet(child, options)
            ) : (
                <KitTabSet node={child} options={options} />
            );
        }
        if (child instanceof RowNode) {
            return (
                <Dockable.Row node={child} renderSplitter={renderSplitter}>
                    {renderNode}
                </Dockable.Row>
            );
        }
        return null;
    };
    return { renderNode, renderSplitter };
}

/** Renders what goes inside a border's `Dockable.Tab` (default: the tab's name). */
export type RenderBorderTab = (tab: TabNode) => ReactNode;

/** The kit's border strip: a `Dockable.Border` with its tab list. */
export function KitBorder({
    node,
    renderTab,
}: {
    node: BorderNode;
    renderTab?: RenderBorderTab | undefined;
}) {
    return (
        <Dockable.Border node={node} className={styles.border}>
            <Dockable.TabList
                aria-label={`${node.getLocation().getName()} panels`}
                className={styles.borderTabList}
            >
                {(tab) => (
                    <Dockable.Tab node={tab} className={styles.borderTab}>
                        {renderTab ? renderTab(tab) : tab.getName()}
                    </Dockable.Tab>
                )}
            </Dockable.TabList>
        </Dockable.Border>
    );
}

/** The kit's border panel area, with the kit's splitter on the layout's side of it. */
export function KitBorderContent({ node }: { node: BorderNode }) {
    return (
        <Dockable.BorderContent
            node={node}
            className={styles.borderContent}
            renderSplitter={(border) => (
                <Dockable.Splitter node={border} className={styles.splitter}>
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

/** The popout host page, under the site's base path (it is opened by hand, not by Next). */
export const popoutURL = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/popout.html`;

/**
 * Keeps each open popout on the example's theme. The page's own `<html>`/`<body>` attributes
 * (light/dark, the body's palette class) are mirrored by the core (`popoutMirrorRoot` on the root);
 * the example theme lives on the docs stage, not on the page's root, so the kit copies it into the
 * popout's `<body>` on open and whenever it changes. An app that themes `<html>` or `<body>` needs
 * only `popoutMirrorRoot`.
 */
function usePopoutTheme(root: React.RefObject<HTMLElement | null>) {
    const documents = useRef(new Set<Document>());

    const apply = useCallback(
        (doc: Document) => {
            const theme = root.current?.closest<HTMLElement>(
                "[data-example-theme]",
            )?.dataset.exampleTheme;
            if (theme) {
                doc.body.dataset.exampleTheme = theme;
            }
        },
        [root],
    );

    useEffect(() => {
        const themed = root.current?.closest("[data-example-theme]");
        if (!themed) {
            return;
        }
        const observer = new MutationObserver(() => {
            for (const doc of documents.current) {
                apply(doc);
            }
        });
        observer.observe(themed, { attributeFilter: ["data-example-theme"] });
        return () => observer.disconnect();
    }, [root, apply]);

    const onOpen = useCallback(
        (_layout: ModelLayout, _window: Window, doc: Document) => {
            documents.current.add(doc);
            apply(doc);
        },
        [apply],
    );
    const onClose = useCallback(
        (_layout: ModelLayout, _window: Window, doc: Document) => {
            documents.current.delete(doc);
        },
        [],
    );
    return { onOpen, onClose };
}

export interface DockLayoutProps extends RenderNodeOptions {
    model: Model;
    /** the content of a tab's panel */
    renderContent: (tab: TabNode) => ReactNode;
    /** intercepts every action: return it to apply it, `undefined` to veto */
    onAction?: OnAction | undefined;
    onModelChange?: OnModelChange | undefined;
    /** extra class names for each panel */
    panelClassName?: string | ((tab: TabNode) => string) | undefined;
    /** extra class names for the root */
    className?: string | undefined;
    /** more props for `Dockable.Root` */
    rootProps?: Partial<RootProps> | undefined;
    /** extra elements inside the root (overlays, effects that need `useDockable`) */
    children?: ReactNode;
    /** the content of a border's tab button (the model's `borders`) */
    renderBorderTab?: RenderBorderTab | undefined;
    /** show the edge docking targets (`Dockable.EdgeIndicator`) during a drag */
    edgeIndicators?: boolean | undefined;
}

/**
 * A complete themed layout: `Dockable.Root` with the kit's recursion, the borders of the model
 * around it, the panel layer, the drop indicator and popout windows.
 */
export function DockLayout(props: DockLayoutProps) {
    const {
        model,
        renderContent,
        onAction,
        onModelChange,
        panelClassName,
        className,
        rootProps,
        children,
        renderBorderTab,
        edgeIndicators,
        ...options
    } = props;
    const { renderNode, renderSplitter } = createRenderNode(options);
    const rootRef = useRef<HTMLDivElement | null>(null);
    const popoutTheme = usePopoutTheme(rootRef);

    return (
        <div className={styles.frame}>
            <Dockable.Root
                ref={rootRef}
                model={model}
                onAction={onAction}
                onModelChange={onModelChange}
                getLabel={getLabel}
                popoutURL={popoutURL}
                // the page's light/dark and body palette class, into each popout (kept in sync)
                popoutMirrorRoot
                className={cn(styles.root, className)}
                {...rootProps}
            >
                <Dockable.Borders
                    renderBar={(border) => (
                        <KitBorder node={border} renderTab={renderBorderTab} />
                    )}
                    renderContent={(border) => (
                        <KitBorderContent node={border} />
                    )}
                >
                    <Dockable.Row renderSplitter={renderSplitter}>
                        {renderNode}
                    </Dockable.Row>
                </Dockable.Borders>
                <Dockable.Panels>
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
                <Dockable.Popout
                    onOpen={popoutTheme.onOpen}
                    onClose={popoutTheme.onClose}
                    className={styles.root}
                >
                    {() => (
                        <>
                            <Dockable.Row renderSplitter={renderSplitter}>
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

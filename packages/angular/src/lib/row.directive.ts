// Behaviour adapted from FlexLayout (https://github.com/caplin/FlexLayout), src/view/Row.tsx (flex sizing from weights, splitters between children);
// the markup and class names are not copied. Copyright (c) 2017 Caplin Systems Ltd. MIT licence,
// see LICENSE.

import {
    type ComponentRef,
    computed,
    contentChild,
    Directive,
    type EmbeddedViewRef,
    effect,
    input,
    type Signal,
    type TemplateRef,
    untracked,
    type ViewContainerRef,
    type ViewRef,
} from "@angular/core";
import type { AnyTypes, DockableTypes, RowNode } from "@fragiola/dockable";
import {
    type DockableContext,
    injectDockableContext,
    injectLayoutContext,
} from "./context";
import { bindMeasurable } from "./internal";
import { DockableDefaultSplitter } from "./splitter.directive";
import {
    DockableRowChild,
    DockableRowSplitter,
    type RowChildContext,
    type RowSplitterContext,
} from "./templates";
import {
    bindStructuralStyle,
    booleanInput,
    dataAttr,
    injectHost,
    px,
} from "./utils";
import { type KeyedItem, KeyedViews, signalContext } from "./views";

export interface RowState {
    orientation: "horizontal" | "vertical";
    /** the layout's root row */
    root: boolean;
    /** a tabset of the layout is maximized outside this row, so the row is hidden */
    hidden: boolean;
}

/**
 * A row (or column) of the layout: `<div dockableRow>` (the layout's root row) or
 * `<div [dockableRow]="node">`. Lays its children out with flex, sized by their weights, renders
 * its `<ng-template dockableRowChild let-node>` per child and inserts a splitter between children
 * (a `<ng-template dockableRowSplitter>` replaces the default one; `[splitter]="false"` renders
 * none).
 */
@Directive({
    selector: "[dockableRow]",
    exportAs: "dockableRow",
    host: {
        "[attr.data-layout-path]": "data().path",
        "[attr.data-orientation]": "data().orientation",
        "[attr.data-root]": "data().root",
    },
})
export class DockableRow<T extends DockableTypes = AnyTypes> {
    /** the row to render; none (a bare `dockableRow`) is the root row of the enclosing layout */
    readonly dockableRow = input<RowNode<T> | "" | undefined>(undefined);
    /** `false` renders no splitters */
    readonly splitter = input(true, { transform: booleanInput });

    private readonly context: DockableContext =
        injectDockableContext("[dockableRow]");
    private readonly layout = injectLayoutContext("[dockableRow]");
    private readonly host = injectHost();
    private readonly childTemplate = contentChild(DockableRowChild, {
        descendants: false,
    });
    private readonly splitterTemplate = contentChild(DockableRowSplitter, {
        descendants: false,
    });

    /** the row rendered now */
    readonly node: Signal<RowNode> = computed(() => {
        this.context.revision();
        const given = this.dockableRow();
        if (given) {
            return given as unknown as RowNode;
        }
        const layoutId = this.layout.layoutId();
        const row = this.context.model().get("root-row", { layoutId });
        if (!row) {
            throw new Error(
                `[dockableRow]: layout "${layoutId}" has no root row`,
            );
        }
        return row;
    });
    private readonly id = computed(() => this.node().id);

    /** what the row shows as `data-*` */
    readonly state: Signal<RowState> = computed(() => {
        this.context.revision();
        const engine = this.layout.engine();
        const id = this.id();
        return {
            orientation:
                engine.adapter.rowOrientation(id) === "horizontal"
                    ? "horizontal"
                    : "vertical",
            root: !this.dockableRow(),
            // a maximized tabset fills the layout: the rows off its path give up their space
            hidden: this.context
                .model()
                .is("node-hidden-by-maximize", { nodeId: id }),
        };
    });

    protected readonly data = computed(() => {
        const state = this.state();
        return {
            path: state.root
                ? "/row"
                : this.layout
                      .engine()
                      .get("layout-path-by", { nodeId: this.id() }),
            orientation: state.orientation,
            root: dataAttr(state.root),
        };
    });

    constructor() {
        bindMeasurable(
            this.context,
            this.layout.engine,
            this.host,
            () => this.id(),
            "row",
        );
        bindStructuralStyle(this.host, () => {
            this.context.revision();
            const state = this.state();
            const flex = this.layout
                .engine()
                .get("flex-by", { nodeId: this.id() });
            return {
                display: state.hidden ? "none" : "flex",
                flexDirection:
                    state.orientation === "horizontal" ? "row" : "column",
                flexBasis: 0,
                flexGrow: flex.grow,
                minWidth: px(flex.minWidth),
                minHeight: px(flex.minHeight),
                maxWidth: px(flex.maxWidth),
                maxHeight: px(flex.maxHeight),
                overflow: "hidden",
                // the root row fills the layout root
                ...(state.root ? { position: "absolute", inset: 0 } : {}),
            };
        });

        // a view per child, with a splitter view before every child but the first
        let views: KeyedViews | undefined;
        let container: unknown;
        effect(() => {
            const child = this.childTemplate();
            const row = this.node();
            const splitter = this.splitter();
            const splitterTemplate = this.splitterTemplate();
            untracked(() => {
                if (!child) {
                    views?.clear();
                    views = undefined;
                    return;
                }
                if (container !== child.viewContainer) {
                    views?.clear();
                    container = child.viewContainer;
                    views = new KeyedViews(child.viewContainer);
                }
                const items: KeyedItem[] = [];
                for (const [index, node] of row.children.entries()) {
                    if (index > 0 && splitter) {
                        items.push(
                            splitterItem(
                                child,
                                splitterTemplate,
                                `splitter:${node.id}`,
                                row,
                                index,
                            ),
                        );
                    }
                    items.push({
                        key: node.id,
                        create: (at) =>
                            child.viewContainer.createEmbeddedView(
                                child.template as unknown as TemplateRef<RowChildContext>,
                                signalContext<RowChildContext>({
                                    $implicit: node,
                                    node,
                                }),
                                { index: at },
                            ),
                        update: (view) =>
                            contextOf<RowChildContext>(view).update({
                                $implicit: node,
                                node,
                            }),
                    });
                }
                views?.sync(items);
            });
        });
    }
}

type Updatable<C> = C & { update(next: C): void };

function contextOf<C>(view: ViewRef): Updatable<C> {
    return (view as EmbeddedViewRef<Updatable<C>>).context;
}

/** The splitter before child `index`: the consumer's template, or a bare `[dockableSplitter]`. */
function splitterItem(
    child: { viewContainer: ViewContainerRef },
    template: { template: TemplateRef<unknown> } | undefined,
    key: string,
    row: RowNode,
    index: number,
): KeyedItem {
    const container = child.viewContainer;
    if (template) {
        const value = (): RowSplitterContext => ({
            $implicit: { node: row, index },
            node: row,
            index,
        });
        return {
            key: `${key}:template`,
            create: (at) =>
                container.createEmbeddedView(
                    template.template as TemplateRef<RowSplitterContext>,
                    signalContext(value()),
                    { index: at },
                ),
            update: (view) =>
                contextOf<RowSplitterContext>(view).update(value()),
        };
    }
    return {
        key: `${key}:default`,
        create: (at) => {
            const ref = container.createComponent(DockableDefaultSplitter, {
                index: at,
            });
            ref.setInput("dockableSplitter", row);
            ref.setInput("index", index);
            defaultSplitters.set(ref.hostView, ref);
            return ref.hostView;
        },
        update: (view) => {
            const ref = defaultSplitters.get(view);
            ref?.setInput("dockableSplitter", row);
            ref?.setInput("index", index);
        },
    };
}

/** The component behind each default splitter's host view, to update its inputs. */
const defaultSplitters = new WeakMap<
    ViewRef,
    ComponentRef<DockableDefaultSplitter>
>();

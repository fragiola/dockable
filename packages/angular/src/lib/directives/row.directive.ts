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
    inject,
    input,
    type Signal,
    type TemplateRef,
    type Type,
    untracked,
    type ViewContainerRef,
    type ViewRef,
} from "@angular/core";
import type { AnyTypes, DockableTypes, RowNode } from "@fragiola/dockable";
import {
    type DockableContext,
    injectDockableContext,
    injectLayoutContext,
} from "../context";
import {
    bindStructuralStyle,
    booleanInput,
    dataAttr,
    injectHost,
    px,
} from "../utils/helpers";
import { bindMeasurable } from "../utils/signals";
import {
    DetachedViews,
    type KeyedItem,
    KeyedViews,
    signalContext,
} from "../utils/views";
import { DockableDefaultSplitter } from "./splitter.directive";
import {
    DockableRowChild,
    DockableRowSplitter,
    type RowChildContext,
    type RowSplitterContext,
} from "./templates.directive";

export interface RowState {
    orientation: "horizontal" | "vertical";
    /** the layout's root row */
    root: boolean;
    /** a tabset of the layout is maximized outside this row, so the row is hidden */
    hidden: boolean;
}

/** The templates a row renders its children and its splitters with. */
interface RowTemplates {
    /** the row's own child template, or its parent's */
    own: boolean;
    child: { template: TemplateRef<unknown>; viewContainer: ViewContainerRef };
    splitter: { template: TemplateRef<unknown> } | undefined;
}

/**
 * A row (or column) of the layout: `<div dockableRow>` (the layout's root row) or
 * `<div [dockableRow]="node">`. Lays its children out with flex, sized by their weights, renders
 * its `<ng-template dockableRowChild let-node>` per child and inserts a splitter between children
 * (a `<ng-template dockableRowSplitter>` in the row, else one directly in the root, replaces the
 * default one; `[splitter]="false"` renders none). A nested row with no child template of its
 * own renders with its parent row's templates, so the recursion is one template: `@if (node.type === "row") { <div [dockableRow]="node"></div> }`.
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
    private readonly parent = inject(DockableRow, {
        optional: true,
        skipSelf: true,
    });
    private readonly detached = new DetachedViews();
    /** its own templates, else the enclosing row's */
    private readonly templates: Signal<RowTemplates | undefined> = computed(
        () => {
            const child = this.childTemplate();
            if (child) {
                return {
                    own: true,
                    child: {
                        template: child.template as TemplateRef<unknown>,
                        viewContainer: child.viewContainer,
                    },
                    splitter:
                        (this.splitterTemplate() as
                            | { template: TemplateRef<unknown> }
                            | undefined) ?? this.context.rowSplitter(),
                };
            }
            const inherited = this.parent?.templates();
            return inherited ? { ...inherited, own: false } : undefined;
        },
    );

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
        let container: ViewContainerRef | null | undefined;
        effect(() => {
            const templates = this.templates();
            const row = this.node();
            const splitter = this.splitter();
            untracked(() => {
                if (!templates) {
                    views?.clear();
                    views = undefined;
                    return;
                }
                const { child, splitter: splitterTemplate } = templates;
                // its own template's container is inside the row; an inherited template renders
                // into no container, its views' nodes are placed inside the row
                const own = templates.own;
                const target = own ? child.viewContainer : null;
                if (container !== target) {
                    views?.clear();
                    container = target;
                    views = new KeyedViews(target);
                }
                const create = this.creator(target);
                const items: KeyedItem[] = [];
                for (const [index, node] of row.children.entries()) {
                    if (index > 0 && splitter) {
                        items.push(
                            splitterItem(
                                create,
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
                            create.embedded(
                                child.template as unknown as TemplateRef<RowChildContext>,
                                signalContext<RowChildContext>({
                                    $implicit: node,
                                    node,
                                }),
                                at,
                            ),
                        update: (view) =>
                            contextOf<RowChildContext>(view).update({
                                $implicit: node,
                                node,
                            }),
                    });
                }
                views?.sync(items);
                if (!own && views) {
                    this.placeInside(items.map((item) => views?.get(item.key)));
                }
            });
        });
    }

    /** How the row's views are created: in its template's container, or in none. */
    private creator(container: ViewContainerRef | null): ViewCreator {
        if (container) {
            return {
                embedded: (template, context, index) =>
                    container.createEmbeddedView(template, context, { index }),
                component: (type, index) =>
                    container.createComponent(type, { index }),
            };
        }
        return {
            embedded: (template, context) =>
                this.detached.embedded(template, context),
            component: (type) => this.detached.component(type),
        };
    }

    /** Puts the views' nodes inside the row, in order, when they are not already. */
    private placeInside(views: readonly (ViewRef | undefined)[]) {
        const nodes = views.flatMap(rootNodes);
        const inside = [...this.host.childNodes].filter((node) =>
            nodes.includes(node),
        );
        if (
            inside.length === nodes.length &&
            inside.every((node, index) => node === nodes[index])
        ) {
            return;
        }
        for (const node of nodes) {
            this.host.appendChild(node);
        }
    }
}

type Updatable<C> = C & { update(next: C): void };

/** Creates a row's views at an index (of a container, or of none). */
interface ViewCreator {
    embedded<C>(
        template: TemplateRef<C>,
        context: C,
        index: number,
    ): EmbeddedViewRef<C>;
    component<C>(type: Type<C>, index: number): ComponentRef<C>;
}

/** The root nodes of a view (an embedded view's, or a component's host element). */
function rootNodes(view: ViewRef | undefined): Node[] {
    return view
        ? ((view as unknown as EmbeddedViewRef<unknown>).rootNodes as Node[])
        : [];
}

function contextOf<C>(view: ViewRef): Updatable<C> {
    return (view as EmbeddedViewRef<Updatable<C>>).context;
}

/** The splitter before child `index`: the consumer's template, or a bare `[dockableSplitter]`. */
function splitterItem(
    create: ViewCreator,
    template: { template: TemplateRef<unknown> } | undefined,
    key: string,
    row: RowNode,
    index: number,
): KeyedItem {
    if (template) {
        const value = (): RowSplitterContext => ({
            $implicit: { node: row, index },
            node: row,
            index,
        });
        return {
            key: `${key}:template`,
            create: (at) =>
                create.embedded(
                    template.template as TemplateRef<RowSplitterContext>,
                    signalContext(value()),
                    at,
                ),
            update: (view) =>
                contextOf<RowSplitterContext>(view).update(value()),
        };
    }
    return {
        key: `${key}:default`,
        create: (at) => {
            const ref = create.component(DockableDefaultSplitter, at);
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

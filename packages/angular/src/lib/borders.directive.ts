// Behaviour adapted from FlexLayout (https://github.com/caplin/FlexLayout), src/view/BorderTabSet.tsx,
// src/view/BorderTab.tsx and src/view/layout/BorderContainer.tsx (which borders show, the frame's
// nesting, the content area's size, split and overlay placement); the markup and class names are
// not copied. Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see LICENSE.

import {
    Component,
    type ComponentRef,
    computed,
    contentChild,
    Directive,
    type EmbeddedViewRef,
    effect,
    forwardRef,
    inject,
    input,
    type Signal,
    type TemplateRef,
    untracked,
    ViewContainerRef,
    type ViewRef,
} from "@angular/core";
import {
    type AnyTypes,
    type BorderLocation,
    type BorderNode,
    type DockableTypes,
    type LayoutEngine,
    OVERLAY_ATTRIBUTE,
} from "@fragiola/dockable";
import {
    DOCKABLE_TAB_CONTAINER,
    type DockableContext,
    injectDockableContext,
    injectLayoutContext,
    type TabContainerContext,
} from "./context";
import { bindMeasurable, dropStateSignal, indicatorSignal } from "./internal";
import { DockableDefaultSplitter } from "./splitter.directive";
import {
    type BorderSplitterContext,
    type BorderTemplateContext,
    DockableBorderSplitter,
    DockableBordersBar,
    DockableBordersContent,
} from "./templates";
import {
    bindStructuralStyle,
    booleanInput,
    dataAttr,
    injectHost,
    moveBefore,
    onDestroy,
    px,
    type StructuralStyle,
} from "./utils";
import { DetachedViews, signalContext } from "./views";

/** What a border shows: `[dockableBorderContent]`'s state (`[dockableBorder]` adds its tab direction). */
export interface BorderContentState {
    /** the side of the layout the border is on */
    location: BorderLocation;
    /** the direction its tabs run: `"vertical"` for a start or end border */
    orientation: "horizontal" | "vertical";
    /** a tab is selected, so the border's panel is open */
    open: boolean;
    /** the panel opens over the layout (`mode: "overlay"`) instead of beside it */
    overlay: boolean;
    /** the border has no tabs */
    empty: boolean;
    /** the current drag would drop into this border (its strip or its open panel) */
    dropTarget: boolean;
    /** the current drag is over this border, but a drop rule refuses it */
    dropRefused: boolean;
}

export interface BorderState extends BorderContentState {
    /** the start border's tab direction (the `tabDirection` input): `"up"` (default) or `"down"` */
    tabDirection: "up" | "down" | undefined;
}

export interface BordersState {
    /** the layout has at least one border showing */
    borders: boolean;
}

const LOCATIONS: readonly BorderLocation[] = ["top", "bottom", "start", "end"];

/** The state of a border, from its current node. */
function borderState(
    context: DockableContext,
    layout: { engine: Signal<LayoutEngine> },
    node: Signal<BorderNode>,
): Signal<BorderContentState> {
    const drop = dropStateSignal(layout.engine, () => node().id);
    return computed(() => {
        context.revision();
        const border = node();
        const location = border.location;
        return {
            location,
            orientation:
                location === "start" || location === "end"
                    ? "vertical"
                    : "horizontal",
            open: border.selected !== -1,
            overlay: context
                .model()
                .is("border-overlay", { borderId: border.id }),
            empty: border.children.length === 0,
            dropTarget: drop().target,
            dropRefused: drop().refused,
        };
    });
}

/** The data attributes of a border's state, shared by its strip and its content. */
function borderData(state: BorderContentState) {
    return {
        location: state.location,
        orientation: state.orientation,
        open: dataAttr(state.open),
        overlay: dataAttr(state.overlay),
        docked: dataAttr(!state.overlay),
        empty: dataAttr(state.empty),
    };
}

/** A border node, read again from the model as it changes. */
function currentBorder<T extends DockableTypes>(
    context: DockableContext,
    given: Signal<BorderNode<T>>,
): Signal<BorderNode> {
    return computed(() => {
        context.revision();
        const node = context.model().get("node-by", { id: given().id });
        return node?.type === "border"
            ? node
            : (given() as unknown as BorderNode);
    });
}

/**
 * A border's strip: `<div [dockableBorder]="border">`, the bar on one side of the layout that holds
 * its tabs. Put a `[dockableTabList]` inside (it runs vertically in a start or end border).
 * Clicking a tab opens the border's panel; clicking the selected tab closes it. Render it from the
 * `<ng-template dockableBordersBar let-border>` of `[dockableBorders]`. Rotating the tab labels of a
 * side border is styling, and yours.
 */
@Directive({
    selector: "[dockableBorder]",
    exportAs: "dockableBorder",
    providers: [
        {
            provide: DOCKABLE_TAB_CONTAINER,
            useExisting: forwardRef(() => DockableBorder),
        },
    ],
    host: {
        "[attr.data-layout-path]": "data().path",
        "[attr.data-location]": "data().location",
        "[attr.data-orientation]": "data().orientation",
        "[attr.data-open]": "data().open",
        "[attr.data-overlay]": "data().overlay",
        "[attr.data-docked]": "data().docked",
        "[attr.data-empty]": "data().empty",
        "[attr.data-tab-direction]": "data().tabDirection",
        "[attr.data-drop-target]": "data().dropTarget",
        "[attr.data-drop-refused]": "data().dropRefused",
    },
})
export class DockableBorder<T extends DockableTypes = AnyTypes>
    implements TabContainerContext
{
    readonly dockableBorder = input.required<BorderNode<T>>();
    /**
     * the start border's tab direction, exposed as `data-tab-direction` for your styles (rotating
     * the labels is yours): `"up"` (default) or `"down"`
     */
    readonly tabDirection = input<"up" | "down" | undefined>(undefined);

    private readonly context: DockableContext =
        injectDockableContext("[dockableBorder]");
    private readonly layout = injectLayoutContext("[dockableBorder]");
    private readonly host = injectHost();
    private readonly node = currentBorder(this.context, this.dockableBorder);
    readonly containerId: Signal<string> = computed(
        () => this.dockableBorder().id,
    );
    private readonly border = borderState(this.context, this.layout, this.node);

    /** what the strip shows as `data-*` */
    readonly state: Signal<BorderState> = computed(() => ({
        ...this.border(),
        tabDirection:
            this.node().location === "start"
                ? (this.tabDirection() ?? "up")
                : undefined,
    }));

    protected readonly data = computed(() => {
        const state = this.state();
        return {
            path: this.layout
                .engine()
                .get("layout-path-by", { nodeId: this.containerId() }),
            ...borderData(state),
            tabDirection: state.tabDirection ?? null,
            dropTarget: dataAttr(state.dropTarget),
            dropRefused: dataAttr(state.dropRefused),
        };
    });

    constructor() {
        bindMeasurable(
            this.context,
            this.layout.engine,
            this.host,
            () => this.containerId(),
            "borderheader",
        );
        bindStructuralStyle(this.host, () => ({
            display: "flex",
            flexDirection:
                this.state().orientation === "vertical" ? "column" : "row",
        }));
    }
}

/**
 * The place a border's panel opens: `<div [dockableBorderContent]="border">`, an area sized by the
 * border's `size` (the engine positions the selected tab's panel over it) and the border's
 * splitter, on the layout's side of it (a `<ng-template dockableBorderSplitter let-node>` inside
 * replaces the default one; `[splitter]="false"` renders none). Hidden while no tab is selected. A
 * docked border sits beside the layout and shrinks it; an overlay border (`mode: "overlay"`) is
 * positioned over the layout's edge, so its stacking (`z-index`) is yours. `[dockableBorders]`
 * renders one per border unless its `<ng-template dockableBordersContent let-border>` does.
 */
@Directive({
    selector: "[dockableBorderContent]",
    exportAs: "dockableBorderContent",
    host: {
        "[attr.data-layout-path]": "data().path",
        "[attr.data-location]": "data().location",
        "[attr.data-orientation]": "data().orientation",
        "[attr.data-open]": "data().open",
        "[attr.data-overlay]": "data().overlay",
        "[attr.data-docked]": "data().docked",
        "[attr.data-empty]": "data().empty",
    },
})
export class DockableBorderContent<T extends DockableTypes = AnyTypes> {
    readonly dockableBorderContent = input.required<BorderNode<T>>();
    /** `false` renders no splitter (the panel keeps its size) */
    readonly splitter = input(true, { transform: booleanInput });

    private readonly context: DockableContext = injectDockableContext(
        "[dockableBorderContent]",
    );
    private readonly layout = injectLayoutContext("[dockableBorderContent]");
    private readonly host = injectHost();
    private readonly splitterTemplate = contentChild(DockableBorderSplitter, {
        descendants: false,
    });
    private readonly node = currentBorder(
        this.context,
        this.dockableBorderContent,
    );
    private readonly id = computed(() => this.node().id);

    /** what the content shows as `data-*` */
    readonly state: Signal<BorderContentState> = borderState(
        this.context,
        this.layout,
        this.node,
    );
    private readonly path = computed(() => {
        this.context.revision();
        return this.layout
            .engine()
            .get("layout-path-by", { nodeId: this.id() });
    });

    protected readonly data = computed(() => ({
        path: `${this.path()}/content`,
        ...borderData(this.state()),
    }));

    constructor() {
        const doc = this.host.ownerDocument;
        // the area the engine positions the panel over, and an anchor for the splitter on each
        // side of it: the splitter is on the layout's side (after the area on the start and top)
        const area = doc.createElement("div");
        const before = doc.createComment("");
        const after = doc.createComment("");
        this.host.append(before, area, after);
        onDestroy(() => {
            area.remove();
            before.remove();
            after.remove();
        });
        effect(() => {
            area.setAttribute("data-layout-path", `${this.path()}/area`);
        });
        bindMeasurable(
            this.context,
            this.layout.engine,
            area,
            () => this.id(),
            "bordercontent",
        );
        bindStructuralStyle(area, () => {
            this.context.revision();
            const node = this.node();
            const { size, minSize, maxSize } =
                this.context
                    .model()
                    .get("border-settings-by", { borderId: node.id }) ?? {};
            return node.location === "start" || node.location === "end"
                ? {
                      width: px(size),
                      minWidth: px(minSize),
                      maxWidth: px(maxSize),
                  }
                : {
                      height: px(size),
                      minHeight: px(minSize),
                      maxHeight: px(maxSize),
                  };
        });
        bindStructuralStyle(this.host, () => {
            this.context.revision();
            const state = this.state();
            const horizontal =
                state.location === "start" || state.location === "end";
            const style: Record<string, string | number | undefined> = {
                display: state.open ? "flex" : "none",
                flexDirection: horizontal ? "row" : "column",
                flexShrink: 0,
            };
            if (state.overlay) {
                // hit-testing, not cosmetics: the overlay paints over the layout (its z-index is
                // yours), but presses must reach the tab panel under its empty area; its splitter
                // takes them back
                const placement =
                    this.layout
                        .engine()
                        .get("overlay-placement-by", { borderId: this.id() }) ??
                    {};
                style.position = "absolute";
                for (const [key, value] of Object.entries(placement)) {
                    style[key] = px(value as number | undefined);
                }
                style.pointerEvents = "none";
            }
            return style as StructuralStyle;
        });
        // a press inside an open overlay (its splitter included) does not close it
        effect(() => {
            if (this.state().overlay) {
                this.host.setAttribute(OVERLAY_ATTRIBUTE, "");
            } else {
                this.host.removeAttribute(OVERLAY_ATTRIBUTE);
            }
        });

        // the splitter, while the panel is open
        let current:
            | {
                  key: string;
                  view: ViewRef;
                  update: (node: BorderNode) => void;
              }
            | undefined;
        effect(() => {
            const template = this.splitterTemplate();
            const node = this.node();
            const open = this.state().open && this.splitter();
            const anchor =
                node.location === "start" || node.location === "top"
                    ? after
                    : before;
            untracked(() => {
                const key = open
                    ? `${template ? "template" : "default"}:${anchor === after ? "after" : "before"}`
                    : "";
                if (current && current.key !== key) {
                    current.view.destroy();
                    current = undefined;
                }
                if (!open) {
                    return;
                }
                if (!current) {
                    current = template
                        ? createTemplateSplitter(
                              template as unknown as TemplateSource,
                              node,
                          )
                        : createDefaultSplitter(this.detached, node);
                    current.key = key;
                }
                current.update(node);
                moveBefore(viewRoots(current.view), anchor);
            });
        });
        onDestroy(() => current?.view.destroy());
    }

    /** where a default splitter is created: in no container (its node is placed here) */
    private readonly detached = new DetachedViews();
}

function viewRoots(view: ViewRef): Node[] {
    return (view as EmbeddedViewRef<unknown>).rootNodes as Node[];
}

/** A template directive, seen with its registry erased. */
interface TemplateSource {
    template: TemplateRef<unknown>;
    viewContainer: ViewContainerRef;
}

function createTemplateSplitter(template: TemplateSource, node: BorderNode) {
    const context = signalContext<BorderSplitterContext>({
        $implicit: node,
        node,
    });
    const view = template.viewContainer.createEmbeddedView(
        template.template as unknown as TemplateRef<BorderSplitterContext>,
        context,
    );
    return {
        key: "",
        view: view as ViewRef,
        update: (next: BorderNode) =>
            context.update({ $implicit: next, node: next }),
    };
}

function createDefaultSplitter(detached: DetachedViews, node: BorderNode) {
    const ref: ComponentRef<DockableDefaultSplitter> = detached.component(
        DockableDefaultSplitter,
    );
    ref.setInput("dockableSplitter", node);
    return {
        key: "",
        view: ref.hostView,
        update: (next: BorderNode) => ref.setInput("dockableSplitter", next),
    };
}

/**
 * The frame that places the borders around the main layout, as FlexLayout does: the top and bottom
 * strips span the full width, the start and end strips sit between them, and each border's panel
 * area sits between its strip and the layout. `<div dockableBorders>` replaces the root
 * `dockableRow` directly inside `[dockableRoot]`, with the row inside it, beside its
 * `<ng-template dockableBordersBar let-border>` (and, to render the panel areas yourself,
 * `<ng-template dockableBordersContent let-border>`). It adds only structural flex elements.
 *
 * A border shows when its `show` is on and, if it `autoHide`s, when it has tabs or a drag reveals
 * it (near its edge of the layout).
 */
@Directive({
    selector: "[dockableBorders]",
    exportAs: "dockableBorders",
    host: {
        "[attr.data-layout-path]": '"/borders"',
        "[attr.data-borders]": "data().borders",
    },
})
export class DockableBorders {
    private readonly context: DockableContext =
        injectDockableContext("[dockableBorders]");
    private readonly layout = injectLayoutContext("[dockableBorders]");
    private readonly host = injectHost();
    private readonly bar = contentChild(DockableBordersBar, {
        descendants: false,
    });
    private readonly content = contentChild(DockableBordersContent, {
        descendants: false,
    });
    private readonly container = inject(ViewContainerRef);
    private readonly shownIds = indicatorSignal(this.layout.engine, () => {
        this.context.revision();
        const engine = this.layout.engine();
        return this.context
            .model()
            .get("borders")
            .filter((border) =>
                engine.is("border-shown", { borderId: border.id }),
            )
            .map((border) => border.id)
            .join("\n");
    });
    private readonly shown = computed(() => {
        this.context.revision();
        const ids = this.shownIds().split("\n");
        const borders = this.context.model().get("borders");
        const shown = new Map<BorderLocation, BorderNode>();
        for (const location of LOCATIONS) {
            const border = borders.find((b) => b.location === location);
            if (border && ids.includes(border.id)) {
                shown.set(location, border);
            }
        }
        return shown;
    });

    /** what the frame shows as `data-*` */
    readonly state: Signal<BordersState> = computed(() => ({
        borders: this.shown().size > 0,
    }));

    protected readonly data = computed(() => ({
        borders: dataAttr(this.state().borders),
    }));

    constructor() {
        const doc = this.host.ownerDocument;
        const fill: StructuralStyle = {
            display: "flex",
            flexGrow: 1,
            flexBasis: 0,
            minWidth: 0,
            minHeight: 0,
        };
        const element = (path: string, style: StructuralStyle) => {
            const div = doc.createElement("div");
            div.setAttribute("data-layout-path", path);
            for (const [key, value] of Object.entries(style)) {
                if (value !== undefined) {
                    div.style.setProperty(
                        key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`),
                        String(value),
                    );
                }
            }
            return div;
        };
        const anchor = () => doc.createComment("");
        // the main layout's place: the root row fills it (position: absolute; inset: 0)
        const main = element("/main", { ...fill, position: "relative" });
        const middle = element("/borders/middle", {
            ...fill,
            flexDirection: "row",
        });
        // the anchor of top and bottom overlays
        const inner = element("/borders/inner", {
            ...fill,
            flexDirection: "column",
            position: "relative",
        });
        // the anchor of start and end overlays
        const center = element("/borders/center", {
            ...fill,
            flexDirection: "row",
            position: "relative",
        });
        const anchors = {
            bar: {
                top: anchor(),
                start: anchor(),
                end: anchor(),
                bottom: anchor(),
            },
            content: {
                top: anchor(),
                start: anchor(),
                end: anchor(),
                bottom: anchor(),
            },
        } satisfies Record<"bar" | "content", Record<BorderLocation, Comment>>;
        // built once the consumer's children exist (the first render): they (the main layout,
        // the templates' anchors) go into /main
        let framed = false;
        const frame = () => {
            if (framed) {
                return;
            }
            framed = true;
            main.append(...this.host.childNodes);
            center.append(anchors.content.start, main, anchors.content.end);
            inner.append(anchors.content.top, center, anchors.content.bottom);
            middle.append(anchors.bar.start, inner, anchors.bar.end);
            this.host.append(anchors.bar.top, middle, anchors.bar.bottom);
        };
        // fills the layout root, as the root row does without borders
        bindStructuralStyle(this.host, () => ({
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
        }));

        type Rendered = {
            key: string;
            view: ViewRef;
            update: (border: BorderNode) => void;
        };
        const rendered = new Map<string, Rendered>();
        effect(() => {
            const shown = this.shown();
            const bar = this.bar();
            const content = this.content();
            untracked(() => {
                frame();
                const keep = new Set<string>();
                for (const [location, border] of shown) {
                    const slots: [
                        "bar" | "content",
                        TemplateSource | undefined,
                    ][] = [
                        ["bar", bar as unknown as TemplateSource | undefined],
                        [
                            "content",
                            content
                                ? {
                                      template:
                                          content.template as unknown as TemplateRef<unknown>,
                                      viewContainer: this.container,
                                  }
                                : undefined,
                        ],
                    ];
                    for (const [slot, template] of slots) {
                        if (slot === "bar" && !template) {
                            continue;
                        }
                        const key = `${slot}:${border.id}:${template ? "template" : "default"}`;
                        keep.add(key);
                        let entry = rendered.get(key);
                        if (!entry) {
                            entry = template
                                ? this.createFromTemplate(key, template, border)
                                : this.createDefaultContent(key, border);
                            rendered.set(key, entry);
                        }
                        entry.update(border);
                        moveBefore(
                            viewRoots(entry.view),
                            anchors[slot][location],
                        );
                    }
                }
                for (const [key, entry] of rendered) {
                    if (!keep.has(key)) {
                        entry.view.destroy();
                        rendered.delete(key);
                    }
                }
            });
        });
        onDestroy(() => {
            for (const entry of rendered.values()) {
                entry.view.destroy();
            }
        });
    }

    private createFromTemplate(
        key: string,
        template: TemplateSource,
        border: BorderNode,
    ) {
        const context = signalContext<BorderTemplateContext>({
            $implicit: border,
            border,
        });
        const view = template.viewContainer.createEmbeddedView(
            template.template as unknown as TemplateRef<BorderTemplateContext>,
            context,
        );
        return {
            key,
            view: view as ViewRef,
            update: (next: BorderNode) =>
                context.update({ $implicit: next, border: next }),
        };
    }

    private createDefaultContent(key: string, border: BorderNode) {
        const ref = this.container.createComponent(
            DockableDefaultBorderContent,
        );
        ref.setInput("dockableBorderContent", border);
        return {
            key,
            view: ref.hostView,
            update: (next: BorderNode) =>
                ref.setInput("dockableBorderContent", next),
        };
    }
}

/**
 * The panel area `[dockableBorders]` renders for a border when no content template is given: a
 * bare `div` with `[dockableBorderContent]`.
 * @internal
 */
@Component({
    selector: "div[dockableDefaultBorderContent]",
    template: "",
    hostDirectives: [
        {
            directive: DockableBorderContent,
            inputs: ["dockableBorderContent", "splitter"],
        },
    ],
})
export class DockableDefaultBorderContent {
    constructor() {
        // the selector's attribute is how Angular names the host it creates: not the consumer's
        injectHost().removeAttribute("dockableDefaultBorderContent");
    }
}

// Behaviour adapted from FlexLayout (https://github.com/caplin/FlexLayout), src/view/TabButton.tsx and src/view/TabSet.tsx (drag start/end, tabset activation);
// the markup and class names are not copied. Copyright (c) 2017 Caplin Systems Ltd. MIT licence,
// see LICENSE.
import {
    type AnyTypes,
    type BorderLocation,
    type BorderNode,
    type ContainerDropState,
    createSplitterController,
    type DockableTypes,
    DragDropManager,
    type DragState,
    type DropIndicatorSnapshot,
    type DropLocation,
    type DropZoneOptions,
    type LayoutEngine,
    type LayoutState,
    type MeasurableKind,
    type Model,
    type NewTabDropped,
    type RowNode,
    type SplitterAria,
    type SplitterControllerState,
    type TabContainer,
    type TabInitOf,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable";
import {
    type ComputedRef,
    type CSSProperties,
    computed,
    inject,
    type MaybeRefOrGetter,
    onScopeDispose,
    type Ref,
    shallowRef,
    toValue,
    watch,
} from "vue";
import {
    ModelKey,
    typedEngine,
    typedModel,
    useDockableContext,
    useLayoutContext,
} from "./context";
import { type ElementRef, elementRef, useExternal } from "./utils/render";

export interface UseDockableResult<T extends DockableTypes = AnyTypes> {
    /**
     * the model of the enclosing `Dockable.Root`: the layout's data and its rules. Change the layout
     * with `model.run("tab.close", { tabId: tab })`, read it with `model.get`/`model.is`
     */
    model: Model<T>;
    /**
     * the engine of the layout this component renders in (the main layout's, or a popout
     * window's): screen actions (`engine.run("popout", { nodeId: node })`) and view facts (`engine.get`)
     */
    engine: LayoutEngine<T>;
    /** the id of the layout this component renders in: `"main"` or a window's id */
    layoutId: string;
}

/**
 * The model, the engine and the layout of the enclosing `Dockable.Root`. Pass the model's registry
 * as the type argument (`useDockable<Types>()`); a child cannot infer it through injection. Call it
 * in `setup`: a new model remounts the root, so the values never change for a component.
 */
export function useDockable<
    T extends DockableTypes = AnyTypes,
>(): UseDockableResult<T> {
    const context = useDockableContext("useDockable");
    const layout = useLayoutContext("useDockable");
    return {
        model: typedModel<T>(context.model),
        engine: typedEngine<T>(layout.engine),
        layoutId: layout.layoutId,
    };
}

export interface UseModelStateOptions<
    T extends DockableTypes = AnyTypes,
    S = unknown,
> {
    /** the model to read; default: the enclosing `Dockable.Root`'s (then it needs one) */
    model?: MaybeRefOrGetter<Model<T> | undefined>;
    /** whether two selections are the same, so readers are not triggered (`Object.is`) */
    isEqual?: ((a: S, b: S) => boolean) | undefined;
}

/**
 * A value selected from the model's state, as a read-only ref that changes only when the
 * selection changes (`isEqual`, `Object.is` by default). The selector runs once per state; keep it
 * pure. Inside a `Dockable.Root` it reads the root's model; pass `model` to read one anywhere.
 *
 * ```ts
 * const count = useModelState<Types, number>((state, model) => model.get("all-tabs").length);
 * ```
 */
export function useModelState<T extends DockableTypes = AnyTypes, S = unknown>(
    selector: (state: LayoutState<T>, model: Model<T>) => S,
    options: UseModelStateOptions<T, S> = {},
): Readonly<Ref<S>> {
    const isEqual = options.isEqual ?? Object.is;
    const injected = inject(ModelKey, null);
    const resolve = (): Model<T> => {
        const model =
            toValue(options.model) ??
            (injected ? typedModel<T>(injected) : undefined);
        if (!model) {
            throw new Error(
                "useModelState must be used inside Dockable.Root, or be given a model",
            );
        }
        return model;
    };
    const first = resolve();
    const value = shallowRef<S>(selector(first.state, first));
    watch(
        resolve,
        (model, previous, onCleanup) => {
            const select = () => {
                const next = selector(model.state, model);
                if (!isEqual(value.value, next)) {
                    value.value = next;
                }
            };
            if (previous !== undefined) {
                // another model: its selection, whatever `isEqual` says
                value.value = selector(model.state, model);
            }
            onCleanup(model.subscribe(select));
        },
        { immediate: true, flush: "sync" },
    );
    return value;
}

export interface TabSetState {
    /** the tabset is its layout's active tabset */
    active: boolean;
    /** the tabset is maximized */
    maximized: boolean;
    /** another tabset of the layout is maximized, so this one is hidden */
    hidden: boolean;
    /** the tabset has no tabs */
    empty: boolean;
    /** the current drag would drop into or beside this tabset (its content or its strip) */
    dropTarget: boolean;
    /** while it is the drop target: where the drag would dock relative to it */
    dropLocation: DropLocation | undefined;
    /** the current drag is over this tabset, but a drop rule refuses it */
    dropRefused: boolean;
    /**
     * while the drag aims at this tabset's strip: the index among its tabs the tab would be
     * inserted at (its length for the end), else `undefined`
     */
    dropIndex: number | undefined;
}

/** @internal the engine's drop indicator state, selected: triggers only when the selection changes */
export function useIndicator<S>(
    engine: LayoutEngine,
    select: (indicator: DropIndicatorSnapshot) => S,
): ComputedRef<S> {
    const manager = engine.adapter.getDragDropManager();
    return useExternal(manager.subscribe, () =>
        select(manager.getIndicatorState()),
    );
}

/** @internal a template ref that registers its element with the engine, measured as `kind` */
export function useMeasurable(
    engine: LayoutEngine,
    id: () => string,
    kind: MeasurableKind,
): ElementRef {
    return elementRef(
        (element) => {
            const nodeId = id();
            engine.adapter.registerMeasurable(nodeId, kind, element);
            return () => engine.adapter.registerMeasurable(nodeId, kind, null);
        },
        () => [id()],
    );
}

/** @internal what the current drag means for a tab container (the core's answer, stable) */
export function useDropState(
    engine: LayoutEngine,
    containerId: () => string,
): ComputedRef<ContainerDropState> {
    const manager = engine.adapter.getDragDropManager();
    return useExternal(manager.subscribe, () =>
        engine.adapter.getDropState(containerId()),
    );
}

/** What goes on a tabset's element. */
export interface TabSetElementProps {
    /** template ref (measured as the tabset) */
    ref: ElementRef;
    /** makes the tabset active on a primary pointer press */
    onPointerdown: (event: PointerEvent) => void;
}

export interface UseTabSetResult {
    /** what the tabset shows as `data-*` */
    state: ComputedRef<TabSetState>;
    /** what goes on the tabset's element */
    props: ComputedRef<TabSetElementProps>;
}

/**
 * The lower layer of `Dockable.TabSet`: its state, and the props for its element (the measurement
 * ref and the activation listener).
 */
export function useTabSet<T extends DockableTypes>(
    node: MaybeRefOrGetter<TabsetNode<T>>,
): UseTabSetResult {
    const { model, revision } = useDockableContext("useTabSet");
    const { engine } = useLayoutContext("useTabSet");
    const id = () => toValue(node).id;
    const drop = useDropState(engine, id);
    const state = computed<TabSetState>(() => {
        revision.value;
        const tabsetId = id();
        const current = drop.value;
        return {
            active: model.is("tabset-active", { tabsetId }),
            maximized: model.is("tabset-maximized", { tabsetId }),
            hidden: model.is("node-hidden-by-maximize", { nodeId: tabsetId }),
            empty: toValue(node).children.length === 0,
            dropTarget: current.target,
            dropLocation: current.location,
            dropRefused: current.refused,
            dropIndex: current.index,
        };
    });
    const ref = useMeasurable(engine, id, "tabset");
    const onPointerdown = (event: PointerEvent) => {
        engine.adapter.handleTabSetPointerDown(id(), event);
    };
    const props = computed<TabSetElementProps>(() => ({ ref, onPointerdown }));
    return { state, props };
}

/** What a border shows: `Dockable.BorderContent`'s state (`Dockable.Border` adds its tab direction). */
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

export interface UseBorderResult {
    /** what the border shows as `data-*` */
    state: ComputedRef<BorderContentState>;
    /** what goes on the border's strip */
    props: ComputedRef<{
        /** template ref (measured as the border's tab header) */
        ref: ElementRef;
    }>;
}

/** The lower layer of `Dockable.Border`: its state, and the props for its strip. */
export function useBorder<T extends DockableTypes>(
    node: MaybeRefOrGetter<BorderNode<T>>,
): UseBorderResult {
    const { model, revision } = useDockableContext("useBorder");
    const { engine } = useLayoutContext("useBorder");
    const id = () => toValue(node).id;
    const drop = useDropState(engine, id);
    const state = computed<BorderContentState>(() => {
        revision.value;
        const border = toValue(node);
        const location = border.location;
        const vertical = location === "start" || location === "end";
        return {
            location,
            orientation: vertical ? "vertical" : "horizontal",
            open: border.selected !== -1,
            overlay: model.is("border-overlay", { borderId: border.id }),
            empty: border.children.length === 0,
            dropTarget: drop.value.target,
            dropRefused: drop.value.refused,
        };
    });
    const ref = useMeasurable(engine, id, "borderheader");
    return { state, props: computed(() => ({ ref })) };
}

export interface UseTabOverflowResult<T extends DockableTypes = AnyTypes> {
    /** some of the container's tabs do not fit, so they are hidden */
    overflowing: ComputedRef<boolean>;
    /** the hidden tabs, in model order: what an overflow menu lists */
    hiddenTabs: ComputedRef<TabOf<T>[]>;
}

/**
 * Tab overflow of a tabset or a border: which of its tabs are hidden because they do not fit in
 * its `Dockable.TabList` (the engine measures the list, the tabs and the
 * `Dockable.TabOverflowTrigger`). The selected tab is never hidden.
 */
export function useTabOverflow<T extends DockableTypes>(
    container: MaybeRefOrGetter<TabContainer<T>>,
): UseTabOverflowResult<T> {
    const { engine } = useLayoutContext("useTabOverflow");
    const hiddenIds = useExternal(engine.adapter.subscribeOverflow, () =>
        engine.adapter.getHiddenTabs(toValue(container).id),
    );
    return {
        overflowing: computed(() => hiddenIds.value.length > 0),
        hiddenTabs: computed(() =>
            toValue(container).children.filter((tab) =>
                hiddenIds.value.includes(tab.id),
            ),
        ),
    };
}

/** @internal whether tab overflow hides a tab of its container (only its own changes trigger) */
export function useTabHidden(
    containerId: () => string,
    tabId: () => string,
): ComputedRef<boolean> {
    const { engine } = useLayoutContext("useTabHidden");
    return useExternal(engine.adapter.subscribeOverflow, () =>
        engine.adapter.getHiddenTabs(containerId()).includes(tabId()),
    );
}

export interface SplitterState extends SplitterControllerState {
    /** `"vertical"` for a splitter between side by side children, as its `aria-orientation` */
    orientation: "horizontal" | "vertical";
    /** row splitters are hidden while a tabset is maximized */
    hidden: boolean;
}

/** What goes on a splitter's element. */
export interface SplitterElementProps {
    ref: ElementRef;
    role: "separator";
    tabindex: 0;
    "aria-orientation": SplitterAria["orientation"];
    "aria-valuenow": number | undefined;
    "aria-valuemin": number | undefined;
    "aria-valuemax": number | undefined;
    "aria-valuetext": string | undefined;
    onPointerdown: (event: PointerEvent) => void;
    onKeydown: (event: KeyboardEvent) => void;
    style: CSSProperties;
}

export interface UseSplitterResult {
    /** what the splitter shows as `data-*` */
    state: ComputedRef<SplitterState>;
    /**
     * what goes on the splitter's element: the ref, `role="separator"` and its ARIA values, focus,
     * the pointer and key listeners, and the structural style (hidden, and the outline preview)
     */
    props: ComputedRef<SplitterElementProps>;
}

/**
 * The lower layer of `Dockable.Splitter`: the splitter before child `index` (1-based) of `node` (a
 * row, or a border with no index). Bind `props` on the separator element.
 */
export function useSplitter<T extends DockableTypes>(
    node: MaybeRefOrGetter<RowNode<T> | BorderNode<T>>,
    index: MaybeRefOrGetter<number | undefined> = 0,
): UseSplitterResult {
    const { revision } = useDockableContext("useSplitter");
    const { engine } = useLayoutContext("useSplitter");
    const key = () => [toValue(node).id, toValue(index) ?? 0] as const;
    const controller = shallowRef(createSplitterController(engine, ...key()));
    watch(
        () => key().join("\n"),
        () => {
            controller.value.dispose();
            controller.value = createSplitterController(engine, ...key());
        },
    );
    onScopeDispose(() => controller.value.dispose());
    const tick = shallowRef(0);
    watch(
        controller,
        (current, _previous, onCleanup) => {
            onCleanup(
                current.subscribe(() => {
                    tick.value++;
                }),
            );
        },
        { immediate: true, flush: "sync" },
    );
    const ref = elementRef(
        (element) => {
            const current = controller.value;
            current.attach(element);
            return () => current.attach(null);
        },
        () => [controller.value],
    );
    const state = computed<SplitterState>(() => {
        tick.value;
        revision.value;
        const current = controller.value;
        return {
            ...current.getState(),
            orientation: current.getAria().orientation,
            hidden: current.isHidden(),
        };
    });
    const props = computed<SplitterElementProps>(() => {
        tick.value;
        revision.value;
        const current = controller.value;
        const aria = current.getAria();
        const { previewOffset } = current.getState();
        const style: CSSProperties = {};
        if (toValue(node).type === "border") {
            // an overlay border's content ignores presses (pointer-events: none), except its splitter
            style.pointerEvents = "auto";
        }
        if (current.isHidden()) {
            style.display = "none";
        }
        if (previewOffset !== undefined) {
            style.transform =
                aria.orientation === "vertical"
                    ? `translateX(${previewOffset}px)`
                    : `translateY(${previewOffset}px)`;
        }
        return {
            ref,
            role: "separator",
            tabindex: 0,
            "aria-orientation": aria.orientation,
            "aria-valuenow": aria.valueNow,
            "aria-valuemin": aria.valueMin,
            "aria-valuemax": aria.valueMax,
            "aria-valuetext": aria.valueText,
            onPointerdown: (event: PointerEvent) =>
                controller.value.onPointerDown(event),
            onKeydown: (event: KeyboardEvent) =>
                controller.value.onKeyDown(event),
            style,
        };
    });
    return { state, props };
}

/** @internal the page-wide drag in progress (triggers when a drag starts or ends) */
export function useDragState(): ComputedRef<DragState | undefined> {
    return useExternal(
        DragDropManager.subscribeDrag,
        DragDropManager.getDragState,
    );
}

/** What goes on a draggable element. */
export interface DragProps {
    /** whether the element is draggable */
    draggable: boolean;
    onDragstart: (event: DragEvent) => void;
    onDragend: (event: DragEvent) => void;
    /**
     * template ref for the element the browser snapshots as the drag image: the dragged element
     * itself, unless you put it on another one
     */
    ref: ElementRef;
}

export interface UseDragNodeResult {
    state: ComputedRef<{
        /** this node is being dragged */
        dragging: boolean;
    }>;
    /** what goes on the dragged element (`draggable` follows the node's `draggable` setting) */
    props: ComputedRef<DragProps>;
}

/**
 * The lower layer of a draggable part: wires a tab or a tabset to the core's drag-and-drop
 * machine. Bind `props` on the dragged element.
 */
export function useDragNode<T extends DockableTypes>(
    node: MaybeRefOrGetter<TabOf<T> | TabsetNode<T>>,
): UseDragNodeResult {
    const { model, revision } = useDockableContext("useDragNode");
    const { engine } = useLayoutContext("useDragNode");
    let image: HTMLElement | null = null;
    const dragState = useDragState();
    const id = () => toValue(node).id;

    const onDragstart = (event: DragEvent) => {
        const nodeId = id();
        if (!engine.adapter.isDraggable(nodeId)) {
            event.preventDefault();
            return;
        }
        event.stopPropagation(); // a tab drag must not also start a tabset drag
        const target = event.currentTarget;
        engine.adapter
            .getDragDropManager()
            .startDrag(
                event,
                nodeId,
                image ?? (target as HTMLElement | null) ?? undefined,
            );
    };
    const onDragend = () => {
        DragDropManager.endDrag();
    };
    const ref = elementRef((element) => {
        image = element;
        return () => {
            image = null;
        };
    });

    return {
        state: computed(() => {
            const drag = dragState.value;
            return {
                // this model's drag only: models of a drag group may share ids
                dragging:
                    drag !== undefined &&
                    drag.subjectOf(model) !== undefined &&
                    drag.dragId === id(),
            };
        }),
        props: computed(() => {
            revision.value;
            return {
                draggable: engine.adapter.isDraggable(id()),
                onDragstart,
                onDragend,
                ref,
            };
        }),
    };
}

export interface UseDragSourceOptions<T extends DockableTypes = AnyTypes> {
    /** the model of the layout the new tab is dropped into (its `Dockable.Root` must be mounted) */
    model: Model<T>;
    /**
     * the tab a drop creates (a `tab.add` init, checked against the registry). A function is called
     * at each drag start, so every drop can get fresh data.
     */
    tab: TabInitOf<T> | (() => TabInitOf<T>);
    /** called after the drop with the new tab's id, or `undefined` when the add was refused */
    onDrop?: NewTabDropped | undefined;
    /** no drag starts while true */
    disabled?: boolean | undefined;
}

export interface UseDragSourceResult {
    state: ComputedRef<{
        /** a drag started by this source is in progress */
        dragging: boolean;
    }>;
    /** what goes on the source element (`draggable` is false while `disabled`) */
    props: ComputedRef<DragProps>;
}

/**
 * The lower layer of `Dockable.DragSource`: turns any element, inside or outside the layout (a
 * sidebar item, a palette entry), into a source of new tabs. Dropping it on the layout runs
 * `tab.add` through the model's middleware. Bind `props` on the element.
 */
export function useDragSource<T extends DockableTypes>(
    options: MaybeRefOrGetter<UseDragSourceOptions<T>>,
): UseDragSourceResult {
    let image: HTMLElement | null = null;
    const started = shallowRef<DragState | undefined>(undefined);
    const dragState = useDragState();

    const onDragstart = (event: DragEvent) => {
        const { model, tab, onDrop, disabled } = toValue(options);
        const target = event.currentTarget as HTMLElement | null;
        if (
            disabled === true ||
            !DragDropManager.startAddDrag(
                model,
                event,
                typeof tab === "function" ? tab() : tab,
                onDrop,
                image ?? target ?? undefined,
            )
        ) {
            // no layout to drop into (not mounted yet): no native drag either
            event.preventDefault();
            return;
        }
        event.stopPropagation(); // an enclosing draggable must not start its own drag
        started.value = DragDropManager.getDragState();
    };
    const onDragend = () => {
        if (
            started.value !== undefined &&
            DragDropManager.getDragState() === started.value
        ) {
            DragDropManager.endDrag();
        }
        started.value = undefined;
    };
    const ref = elementRef((element) => {
        image = element;
        return () => {
            image = null;
        };
    });

    return {
        state: computed(() => ({
            dragging:
                dragState.value !== undefined &&
                dragState.value === started.value,
        })),
        props: computed(() => ({
            draggable: toValue(options).disabled !== true,
            onDragstart,
            onDragend,
            ref,
        })),
    };
}

export interface DropZoneState {
    /** a drag the zone takes is over it */
    over: boolean;
    /** a drag the zone would take is in progress */
    active: boolean;
}

export interface UseDropZoneOptions<T extends DockableTypes = AnyTypes> {
    /** the model whose drags the zone takes */
    model: Model<T>;
    /** whether the zone takes this drag (default: every drag of the model) */
    accepts?: DropZoneOptions<T>["accepts"];
    /**
     * called when the drag is dropped on the zone, with what is dragged: `{ kind: "tab", tab }`,
     * `{ kind: "tabset", tabset }` or, for a new tab (a `Dockable.DragSource` or a foreign drag),
     * `{ kind: "new", tab }`. Nothing is moved: run the command you want (`tab.close`).
     */
    onDrop: DropZoneOptions<T>["onDrop"];
}

export interface UseDropZoneResult {
    state: ComputedRef<DropZoneState>;
    /** what goes on the zone's element */
    props: ComputedRef<{
        /** template ref */
        ref: ElementRef;
    }>;
}

/**
 * The lower layer of `Dockable.DropZone`: makes an element, inside or outside the layout, a place
 * where a drag of the layout can be dropped for the consumer to handle (a trash can, an "open to
 * the right" pad). Bind `props` on the element.
 */
export function useDropZone<T extends DockableTypes>(
    options: MaybeRefOrGetter<UseDropZoneOptions<T>>,
): UseDropZoneResult {
    const over = shallowRef(false);
    const dragState = useDragState();
    const ref = elementRef(
        (element) => {
            const model = toValue(options).model;
            const unregister = DragDropManager.registerDropZone(
                model,
                element,
                {
                    accepts: (drag) => toValue(options).accepts?.(drag) ?? true,
                    onDrop: (drag, event) =>
                        toValue(options).onDrop(drag, event),
                    onOverChange: (value) => {
                        over.value = value;
                    },
                },
            );
            return () => {
                unregister();
                over.value = false;
            };
        },
        () => [toValue(options).model],
    );
    return {
        state: computed(() => {
            const { model, accepts } = toValue(options);
            const subject = dragState.value?.subjectOf(model);
            const active =
                subject !== undefined && (accepts?.(subject) ?? true);
            return { over: over.value && active, active };
        }),
        props: computed(() => ({ ref })),
    };
}

import {
    computed,
    effect,
    inject,
    type Signal,
    signal,
    untracked,
} from "@angular/core";
import type {
    AnyTypes,
    DockableTypes,
    LayoutEngine,
    LayoutState,
    Model,
    TabContainer,
    TabOf,
} from "@fragiola/dockable";
import { type BorderState, DockableBorder } from "./borders.directive";
import {
    DOCKABLE,
    injectDockableContext,
    injectLayoutContext,
    typedEngine,
    typedModel,
} from "./context";
import { DockableDragNode, type DragNodeState } from "./drag-node.directive";
import {
    DockableDragSource,
    DockableDropZone,
    type DragSourceState,
    type DropZoneState,
} from "./drag-source.directive";
import { hiddenTabsSignal } from "./internal";
import { DockableSplitter, type SplitterState } from "./splitter.directive";
import { DockableTab } from "./tab.directive";
import {
    DockableTabSet,
    injectTabContainer,
    type TabSetState,
} from "./tabset.directive";

export interface InjectDockableResult<T extends DockableTypes = AnyTypes> {
    /**
     * the model of the enclosing `[dockableRoot]`: the layout's data and its rules. Change the
     * layout with `model().run("tab.close", { tabId })`, read it with `model().get`/`model().is`
     */
    model: Signal<Model<T>>;
    /**
     * the engine of the layout this code renders in (the main layout's, or a popout window's):
     * screen actions (`engine().run("popout", { nodeId })`) and view facts (`engine().get`)
     */
    engine: Signal<LayoutEngine<T>>;
    /** the id of the layout this code renders in: `"main"` or a window's id */
    layoutId: Signal<string>;
}

/**
 * The model, the engine and the layout of the enclosing `[dockableRoot]`, as signals. Pass the
 * model's registry as the type argument (`injectDockable<Types>()`); a child cannot infer it
 * through injection. Call it in an injection context (a constructor or a field initializer).
 */
export function injectDockable<
    T extends DockableTypes = AnyTypes,
>(): InjectDockableResult<T> {
    const context = injectDockableContext("injectDockable");
    const layout = injectLayoutContext("injectDockable");
    return {
        model: computed(() => typedModel<T>(context.model())),
        engine: computed(() => typedEngine<T>(layout.engine())),
        layoutId: layout.layoutId,
    };
}

export interface InjectModelStateOptions<
    T extends DockableTypes = AnyTypes,
    S = unknown,
> {
    /** the model to read (a model, or a signal of one); default: the enclosing `[dockableRoot]`'s */
    model?: Model<T> | Signal<Model<T> | undefined> | undefined;
    /** whether two selections are the same, so readers are not notified (`Object.is`) */
    isEqual?: ((a: S, b: S) => boolean) | undefined;
}

/**
 * A value selected from the model's state, as a signal that changes only when the selection
 * changes (`isEqual`, `Object.is` by default). The selector runs once per state; keep it pure.
 * Inside a `[dockableRoot]` it reads the root's model; pass `model` to read one anywhere.
 *
 * ```ts
 * readonly count = injectModelState<Types, number>((state, model) => model.get("all-tabs").length);
 * ```
 */
export function injectModelState<
    T extends DockableTypes = AnyTypes,
    S = unknown,
>(
    selector: (state: LayoutState<T>, model: Model<T>) => S,
    options: InjectModelStateOptions<T, S> = {},
): Signal<S> {
    const injected = inject(DOCKABLE, { optional: true });
    const given = options.model;
    const resolve = (): Model<T> => {
        const model =
            (typeof given === "function"
                ? (given as Signal<Model<T> | undefined>)()
                : given) ??
            (injected ? typedModel<T>(injected.model()) : undefined);
        if (!model) {
            throw new Error(
                "injectModelState must be used inside [dockableRoot], or be given a model",
            );
        }
        return model;
    };
    const tick = signal(0);
    effect((onCleanup) => {
        const model = resolve();
        onCleanup(
            model.subscribe(() => {
                tick.update((value) => value + 1);
            }),
        );
        untracked(() => tick.update((value) => value + 1));
    });
    return computed(
        () => {
            tick();
            const model = resolve();
            return selector(model.state, model);
        },
        { equal: options.isEqual ?? Object.is },
    );
}

/** What a part's injection function returns: the part's state, as a signal. */
export interface InjectPartResult<S> {
    state: Signal<S>;
}

function enclosing<D>(directive: D | null, part: string, fn: string): D {
    if (!directive) {
        throw new Error(`${fn} must be used inside [${part}]`);
    }
    return directive;
}

/**
 * The state of the enclosing `[dockableTabSet]` (`active`, `maximized`, the drop target, …), for
 * a component inside it. The directive puts the measurement and the activation on its element.
 */
export function injectTabSet(): InjectPartResult<TabSetState> {
    const tabset = enclosing(
        inject(DockableTabSet, { optional: true }),
        "dockableTabSet",
        "injectTabSet",
    );
    return { state: tabset.state };
}

/** The state of the enclosing `[dockableBorder]` strip (`open`, `overlay`, the drop target, …). */
export function injectBorder(): InjectPartResult<BorderState> {
    const border = enclosing(
        inject(DockableBorder, { optional: true }),
        "dockableBorder",
        "injectBorder",
    );
    return { state: border.state };
}

/**
 * The state of the `[dockableSplitter]` on this element or around it (`dragging`, its orientation,
 * the outline preview). The directive puts the ARIA, the listeners and the structural style on its
 * element.
 */
export function injectSplitter(): InjectPartResult<SplitterState> {
    const splitter = enclosing(
        inject(DockableSplitter, { optional: true }),
        "dockableSplitter",
        "injectSplitter",
    );
    return { state: splitter.state };
}

/** Whether the tab of the enclosing `[dockableTab]` (or `[dockableDragNode]`) is being dragged. */
export function injectDragNode(): InjectPartResult<DragNodeState> {
    const node = inject(DockableDragNode, { optional: true });
    if (node) {
        return { state: node.state };
    }
    const tab = enclosing(
        inject(DockableTab, { optional: true }),
        "dockableDragNode] or [dockableTab",
        "injectDragNode",
    );
    return {
        state: computed(() => ({ dragging: tab.state().dragging })),
    };
}

/** The state of the enclosing `[dockableDragSource]` (`dragging`, `disabled`). */
export function injectDragSource(): InjectPartResult<DragSourceState> {
    const source = enclosing(
        inject(DockableDragSource, { optional: true }),
        "dockableDragSource",
        "injectDragSource",
    );
    return { state: source.state };
}

/** The state of the enclosing `[dockableDropZone]` (`over`, `active`). */
export function injectDropZone(): InjectPartResult<DropZoneState> {
    const zone = enclosing(
        inject(DockableDropZone, { optional: true }),
        "dockableDropZone",
        "injectDropZone",
    );
    return { state: zone.state };
}

export interface InjectTabOverflowResult<T extends DockableTypes = AnyTypes> {
    /** some of the container's tabs do not fit, so they are hidden */
    overflowing: Signal<boolean>;
    /** the hidden tabs, in model order: what an overflow menu lists */
    hiddenTabs: Signal<TabOf<T>[]>;
}

/**
 * Tab overflow of a tabset or a border: which of its tabs are hidden because they do not fit in
 * its `[dockableTabList]` (the engine measures the list, the tabs and the
 * `[dockableTabOverflowTrigger]`). The selected tab is never hidden. Default: the enclosing
 * `[dockableTabSet]` or `[dockableBorder]`.
 */
export function injectTabOverflow<T extends DockableTypes = AnyTypes>(
    container?: () => TabContainer<T>,
): InjectTabOverflowResult<T> {
    const layout = injectLayoutContext("injectTabOverflow");
    const current: () => TabContainer<T> =
        container ?? injectTabContainer<T>("injectTabOverflow");
    const hidden = hiddenTabsSignal(layout.engine, () => current().id);
    return {
        overflowing: computed(() => hidden().length > 0),
        hiddenTabs: computed(() =>
            current().children.filter((tab) => hidden().includes(tab.id)),
        ),
    };
}

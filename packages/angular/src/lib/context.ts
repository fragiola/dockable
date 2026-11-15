import { InjectionToken, inject, type Signal } from "@angular/core";
import type {
    AnyTypes,
    DockableTypes,
    DragGroup,
    KeyMap,
    LayoutEngine,
    Model,
} from "@fragiola/dockable";

/**
 * The context of a `[dockableRoot]`. It holds the model and engines with the registry erased
 * (`AnyTypes`): a child cannot infer the root's `T` through injection, so the typed surface is
 * each part's inputs and the template directives' contexts.
 */
export interface DockableContext {
    /** the model of the root */
    readonly model: Signal<Model>;
    /** the main layout's engine (a new model makes a new one) */
    readonly engine: Signal<LayoutEngine>;
    /**
     * the render revision: every part reads it, so it updates with the layout. Reading it
     * prepares the main engine for the render (`engine.adapter.prepare()`)
     */
    readonly revision: Signal<number>;
    /** the root's `keyMap` input: the parts that advertise or answer its keys read it */
    readonly keyMap: Signal<KeyMap | undefined>;
    /** the element each layout's panels are positioned in, keyed by layout id */
    readonly layers: Signal<ReadonlyMap<string, HTMLElement>>;
    /** sets (or, with `null`, removes) the element a window layout's panels are positioned in */
    setLayer(layoutId: string, element: HTMLElement | null): void;
    /** measures the layout of `engine` once the current render is over */
    scheduleMeasure(engine: LayoutEngine): void;
}

export const DOCKABLE = new InjectionToken<DockableContext>("Dockable");

/** The layout a subtree renders: the main layout, or a popout's. */
export interface LayoutContext {
    readonly layoutId: Signal<string>;
    readonly engine: Signal<LayoutEngine>;
}

export const DOCKABLE_LAYOUT = new InjectionToken<LayoutContext>(
    "DockableLayout",
);

/** The tab container (a tabset or a border) of the parts inside it: `[dockableTabList]`, … */
export interface TabContainerContext {
    readonly containerId: Signal<string>;
}

export const DOCKABLE_TAB_CONTAINER = new InjectionToken<TabContainerContext>(
    "DockableTabContainer",
);

/** The orientation of the enclosing tab list. */
export const DOCKABLE_TAB_LIST = new InjectionToken<
    Signal<"horizontal" | "vertical">
>("DockableTabList");

/** The drag group of a `[dockableDragGroup]`, and the registry of its tabs' content views. */
export interface DragGroupContext {
    readonly group: DragGroup;
    readonly views: ContentViews;
}

/**
 * The content views of a drag group's tabs, keyed by the tab's moveable element (which a
 * transferred tab adopts): a tab moving from one root to another keeps its view, so the state of
 * the components in it survives.
 */
export interface ContentViews {
    /** the view the moveable `key` renders in, and the `[dockablePanels]` that owns it now */
    get(key: string): { owner: object; view: unknown } | undefined;
    set(key: string, owner: object, view: unknown): void;
    /**
     * Gives the view up: it is destroyed (`destroy`) on the next task unless another owner took
     * it meanwhile (a tab moving to another root leaves one layout before it joins the other).
     */
    release(key: string, owner: object, destroy: () => void): void;
}

export const DOCKABLE_DRAG_GROUP = new InjectionToken<DragGroupContext>(
    "DockableDragGroup",
);

export function injectDockableContext(part: string): DockableContext {
    const context = inject(DOCKABLE, { optional: true });
    if (!context) {
        throw new Error(`${part} must be used inside [dockableRoot]`);
    }
    return context;
}

export function injectLayoutContext(part: string): LayoutContext {
    const context = inject(DOCKABLE_LAYOUT, { optional: true });
    if (!context) {
        throw new Error(`${part} must be used inside [dockableRoot]`);
    }
    return context;
}

/**
 * A model of any registry, seen as `Model<AnyTypes>`. `Model<T>` takes `T` in its commands'
 * payloads, so it is not assignable to the erased type; the adapter only passes it on to the core.
 */
export function eraseModel<T extends DockableTypes>(
    model: Model<T>,
): Model<AnyTypes> {
    return model as unknown as Model<AnyTypes>;
}

/** An engine of any registry, seen as `LayoutEngine<AnyTypes>` (see {@link eraseModel}). */
export function eraseEngine<T extends DockableTypes>(
    engine: LayoutEngine<T>,
): LayoutEngine {
    return engine as unknown as LayoutEngine;
}

/** The erased engine seen with the registry `T` the caller declares (`injectDockable<T>()`). */
export function typedEngine<T extends DockableTypes>(
    engine: LayoutEngine,
): LayoutEngine<T> {
    return engine as unknown as LayoutEngine<T>;
}

/** The erased model seen with the registry `T` the caller declares. */
export function typedModel<T extends DockableTypes>(model: Model): Model<T> {
    return model as unknown as Model<T>;
}

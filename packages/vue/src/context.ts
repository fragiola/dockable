import type {
    AnyTypes,
    DockableTypes,
    LayoutEngine,
    Model,
} from "@fragiola/dockable";
import {
    type ComputedRef,
    type InjectionKey,
    inject,
    type Ref,
    type ShallowRef,
} from "vue";

/**
 * The context of a `Dockable.Root`. It holds the model and engines with the registry erased
 * (`AnyTypes`): a child cannot infer the root's `T` through injection, so the typed surface is
 * each part's props and `typedDockable<T>()`.
 */
export interface DockableContextValue {
    /** the main layout's engine */
    readonly engine: LayoutEngine;
    readonly model: Model;
    /** the render revision: every part reads it in its render, so it re-renders with the layout */
    readonly revision: Readonly<Ref<number>>;
    /** the element each layout's panels are rendered in, keyed by layout id */
    readonly layers: Readonly<ShallowRef<ReadonlyMap<string, HTMLElement>>>;
    /** sets (or, with `null`, removes) the element a layout's panels are rendered in */
    setLayer(layoutId: string, element: HTMLElement | null): void;
    /** measures the layout of `engine` once the current render flush is over */
    scheduleMeasure(engine: LayoutEngine): void;
}

export const DockableKey: InjectionKey<DockableContextValue> =
    Symbol("Dockable");

/** The layout a subtree renders: the main layout, or a popout's. */
export interface LayoutContextValue {
    readonly layoutId: string;
    readonly engine: LayoutEngine;
}

export const LayoutKey: InjectionKey<LayoutContextValue> =
    Symbol("DockableLayout");

/** The id of the tab container (a tabset or a border) of the parts inside it: `TabList`, `Tab`. */
export const TabContainerKey: InjectionKey<ComputedRef<string>> = Symbol(
    "DockableTabContainer",
);

/** The orientation of the enclosing tab list. */
export const TabListKey: InjectionKey<ComputedRef<"horizontal" | "vertical">> =
    Symbol("DockableTabList");

/** The model alone, for `useModelState` (it outlives no root: a new model remounts the root). */
export const ModelKey: InjectionKey<Model> = Symbol("DockableModel");

export function useDockableContext(part: string): DockableContextValue {
    const context = inject(DockableKey, null);
    if (!context) {
        throw new Error(
            `Dockable.${part} must be rendered inside Dockable.Root`,
        );
    }
    return context;
}

export function useLayoutContext(part: string): LayoutContextValue {
    const context = inject(LayoutKey, null);
    if (!context) {
        throw new Error(
            `Dockable.${part} must be rendered inside Dockable.Root`,
        );
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

/** The erased engine seen with the registry `T` the caller declares (`useDockable<T>()`). */
export function typedEngine<T extends DockableTypes>(
    engine: LayoutEngine,
): LayoutEngine<T> {
    return engine as unknown as LayoutEngine<T>;
}

/** The erased model seen with the registry `T` the caller declares. */
export function typedModel<T extends DockableTypes>(model: Model): Model<T> {
    return model as unknown as Model<T>;
}

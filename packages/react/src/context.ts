import type {
    AnyTypes,
    DockableLabel,
    DockableTypes,
    IKeyMap,
    LayoutEngine,
    Model,
} from "@fragiola/dockable";
import * as React from "react";

/** Resolves a label key to text. With no resolver, the primitives render no text. */
export type GetLabel = (
    key: DockableLabel,
    ...args: (string | number)[]
) => string | undefined;

/** Where the panel containers of one layout are rendered. */
export interface PanelLayer {
    layoutId: string;
    element: HTMLElement;
    engine: LayoutEngine;
}

/**
 * The context of a `Dockable.Root`. It holds the model and engines with the registry erased
 * (`AnyTypes`): a child cannot infer the root's `T` through context, so the typed surface is each
 * part's props and type argument.
 */
export interface DockableContextValue {
    /** the main layout's engine */
    engine: LayoutEngine;
    model: Model;
    /** the render revision: changes whenever the layout should re-render */
    revision: number;
    getLabel: GetLabel | undefined;
    keyMap: IKeyMap;
    /** the panel layer of each layout, keyed by layout id */
    layers: ReadonlyMap<string, PanelLayer>;
    /** adds (or, with `null`, removes) the panel layer of a layout */
    setLayer: (layoutId: string, layer: PanelLayer | null) => void;
    /** the window callbacks `Dockable.Popout` registers with the root */
    popoutHooks: { current: PopoutHooks };
}

/** Window callbacks a `Dockable.Popout` contributes, by window layout id. */
export interface PopoutHooks {
    title?: ((layoutId: string) => string | undefined) | undefined;
    onOpen?:
        | ((layoutId: string, window: Window, document: Document) => void)
        | undefined;
    onClose?:
        | ((layoutId: string, window: Window, document: Document) => void)
        | undefined;
}

export const DockableContext = React.createContext<DockableContextValue | null>(
    null,
);

/**
 * The model alone: it changes only when the root gets another model, so a component that reads
 * it (`useModelState`) does not re-render with every change of the layout.
 */
export const ModelContext = React.createContext<Model | null>(null);

/** The layout a subtree renders: the main layout, or a popout's. */
export interface LayoutContextValue {
    layoutId: string;
    engine: LayoutEngine;
}

export const LayoutContext = React.createContext<LayoutContextValue | null>(
    null,
);

/** The orientation of the enclosing tab list. */
export const TabListContext = React.createContext<{
    orientation: "horizontal" | "vertical";
}>({ orientation: "horizontal" });

export function useDockableContext(part: string): DockableContextValue {
    const context = React.useContext(DockableContext);
    if (!context) {
        throw new Error(
            `Dockable.${part} must be rendered inside Dockable.Root`,
        );
    }
    return context;
}

export function useLayoutContext(part: string): LayoutContextValue {
    const context = React.useContext(LayoutContext);
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

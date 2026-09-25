import type {
    DockableLabel,
    IKeyMap,
    LayoutEngine,
    Model,
    ModelLayout,
    PopoutCallback,
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

/** Window callbacks a `Dockable.Popout` contributes. */
export interface PopoutHooks {
    title?: ((layout: ModelLayout) => string | undefined) | undefined;
    onOpen?: PopoutCallback | undefined;
    onClose?: PopoutCallback | undefined;
}

export const DockableContext = React.createContext<DockableContextValue | null>(
    null,
);

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

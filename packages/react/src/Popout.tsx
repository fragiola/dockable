// Behaviour adapted from FlexLayout (https://github.com/caplin/FlexLayout), src/view/layout/FloatingWindowContainer.tsx and src/view/PopoutWindow.tsx (per-window rendering);
// the markup and class names are not copied. Copyright (c) 2017 Caplin Systems Ltd. MIT licence,
// see LICENSE.
import type {
    AnyTypes,
    DockableTypes,
    LayoutEngine,
    PopoutCallback,
    WindowLayout,
} from "@fragiola/dockable";
import * as React from "react";
import { createPortal } from "react-dom";
import { LayoutContext, typedModel, useDockableContext } from "./context";
import {
    type DivPrimitiveProps,
    dataAttributes,
    useRenderElement,
} from "./utils/useRender";

export interface PopoutState {
    /** the id of the window layout */
    layoutId: string;
}

export interface PopoutProps<T extends DockableTypes = AnyTypes>
    extends Omit<DivPrimitiveProps<PopoutState>, "title"> {
    /** renders a window layout, usually `<Dockable.Row>{renderNode}</Dockable.Row>` */
    children: (layout: WindowLayout<T>) => React.ReactNode;
    /** the popout document's title; with none, the host page's title is kept */
    title?: ((layout: WindowLayout<T>) => string | undefined) | undefined;
    /** a popout document is ready, before its content renders */
    onOpen?: PopoutCallback<T> | undefined;
    /** a popout window is closing (its tabs dock back into the main layout) */
    onClose?: PopoutCallback<T> | undefined;
}

/**
 * The popout windows. Place it once, directly under `Dockable.Root`, with the model's registry as
 * its type argument (`<Dockable.Popout<Types>>`). The core keeps a native window open for every
 * window layout of the state; once one is ready (styles copied), the child function's result is
 * portalled into it. A node-less `Dockable.Row` inside renders that layout's root row, and panels
 * of tabs in that layout are positioned in the window. Pop a tab out with `tab.popout`.
 */
export function Popout<T extends DockableTypes = AnyTypes>(
    props: PopoutProps<T>,
) {
    const { children, title, onOpen, onClose, ...rest } = props;
    const { engine, model: erased, popoutHooks } = useDockableContext("Popout");
    const model = typedModel<T>(erased);
    const manager = engine.adapter.getPopoutManager();
    React.useSyncExternalStore(
        manager.subscribe,
        manager.getSnapshot,
        manager.getSnapshot,
    );

    // the root calls these by window layout id: hand the typed layout over
    popoutHooks.current = {
        title: (id) => {
            const layout = model.get("window-by", { id });
            return layout && title ? title(layout) : undefined;
        },
        onOpen: (id, win, doc) => {
            const layout = model.get("window-by", { id });
            if (layout) onOpen?.(layout, win, doc);
        },
        onClose: (id, win, doc) => {
            const layout = model.get("window-by", { id });
            if (layout) onClose?.(layout, win, doc);
        },
    };

    return (
        <>
            {model.state.windows.map((layout) => (
                <PopoutWindow key={layout.id} layout={layout} rest={rest}>
                    {children}
                </PopoutWindow>
            ))}
        </>
    );
}

interface PopoutWindowProps<T extends DockableTypes> {
    layout: WindowLayout<T>;
    rest: Omit<DivPrimitiveProps<PopoutState>, "title">;
    children: (layout: WindowLayout<T>) => React.ReactNode;
}

function PopoutWindow<T extends DockableTypes>({
    layout,
    rest,
    children,
}: PopoutWindowProps<T>) {
    const { engine } = useDockableContext("Popout");
    const manager = engine.adapter.getPopoutManager();
    const layoutId = layout.id;

    // the core owns the window (it opens one per window layout while the root is attached)
    const contentRoot = manager.getContentRoot(layoutId);
    const layoutEngine = manager.getLayoutEngine(layoutId);
    if (!contentRoot || !layoutEngine) {
        return null; // renders nothing until the window is ready
    }
    return createPortal(
        <PopoutLayout layout={layout} engine={layoutEngine} rest={rest}>
            {children}
        </PopoutLayout>,
        contentRoot,
        layoutId,
    );
}

interface PopoutLayoutProps<T extends DockableTypes>
    extends PopoutWindowProps<T> {
    engine: LayoutEngine;
}

/** the root of a window layout, inside the popout document */
function PopoutLayout<T extends DockableTypes>({
    layout,
    engine,
    rest,
    children,
}: PopoutLayoutProps<T>) {
    const { setLayer } = useDockableContext("Popout");
    const layoutId = layout.id;
    engine.adapter.prepare();

    const ref = React.useCallback(
        (element: HTMLElement | null) => {
            if (!element) {
                return;
            }
            engine.adapter.attachRoot(element);
            // the window's panels are positioned in this element
            setLayer(layoutId, element);
            return () => {
                engine.adapter.detachRoot();
                setLayer(layoutId, null);
            };
        },
        [engine, layoutId, setLayer],
    );

    // the measure-and-position cycle of the window layout, after every commit
    React.useLayoutEffect(() => {
        engine.run("measure-and-position");
    });

    const layoutContext = React.useMemo(
        () => ({ layoutId, engine }),
        [layoutId, engine],
    );
    const state: PopoutState = { layoutId };
    return useRenderElement("div", rest, {
        state,
        ref,
        props: {
            ...dataAttributes({
                "layout-path":
                    engine.get("layout-path-by", {
                        nodeId: layout.root.id,
                    }) || `/${layoutId}`,
            }),
            children: (
                <LayoutContext.Provider value={layoutContext}>
                    {children(layout)}
                </LayoutContext.Provider>
            ),
        },
        // fills the popout window and is the containing block its panels are positioned in
        style: { position: "absolute", inset: 0 },
    });
}

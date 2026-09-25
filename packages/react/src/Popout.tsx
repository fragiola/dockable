import type {
    LayoutEngine,
    ModelLayout,
    PopoutCallback,
} from "@fragiola/dockable";
import * as React from "react";
import { createPortal } from "react-dom";
import { LayoutContext, useDockableContext } from "./context";
import {
    type DivPrimitiveProps,
    dataAttributes,
    useRenderElement,
} from "./utils/useRender";

export interface PopoutState {
    /** the id of the window layout */
    layoutId: string;
}

export interface PopoutProps
    extends Omit<DivPrimitiveProps<PopoutState>, "title"> {
    /** renders a window layout, usually `<Dockable.Row>{renderNode}</Dockable.Row>` */
    children: (layout: ModelLayout) => React.ReactNode;
    /** the popout document's title; with none, the host page's title is kept */
    title?: ((layout: ModelLayout) => string | undefined) | undefined;
    /** a popout document is ready, before its content renders */
    onOpen?: PopoutCallback | undefined;
    /** a popout window is closing */
    onClose?: PopoutCallback | undefined;
}

/**
 * The popout windows. Place it once, directly under `Dockable.Root`. For every `"window"` layout of
 * the model the core opens a native window; once it is ready (styles copied), the child function's
 * result is portalled into it. A node-less `Dockable.Row` inside renders that layout's root row, and
 * panels of tabs in that layout are positioned in the window. Pop a tab out with
 * `engine.doAction(Actions.popoutTab(tabId, "window"))`.
 */
export function Popout(props: PopoutProps) {
    const { children, title, onOpen, onClose, ...rest } = props;
    const { engine, model, popoutHooks } = useDockableContext("Popout");
    const manager = engine.getPopoutManager();
    React.useSyncExternalStore(
        manager.subscribe,
        manager.getSnapshot,
        manager.getSnapshot,
    );

    popoutHooks.current = { title, onOpen, onClose };

    if (!manager.isSupportsPopout()) {
        return null;
    }
    const windows: ModelLayout[] = [];
    for (const layout of model.getLayouts().values()) {
        if (!layout.isMainLayout() && layout.getType() === "window") {
            windows.push(layout);
        }
    }
    return (
        <>
            {windows.map((layout) => (
                <PopoutWindow
                    key={layout.getLayoutId()}
                    layout={layout}
                    rest={rest}
                >
                    {children}
                </PopoutWindow>
            ))}
        </>
    );
}

interface PopoutWindowProps {
    layout: ModelLayout;
    rest: Omit<DivPrimitiveProps<PopoutState>, "title">;
    children: (layout: ModelLayout) => React.ReactNode;
}

function PopoutWindow({ layout, rest, children }: PopoutWindowProps) {
    const { engine } = useDockableContext("Popout");
    const manager = engine.getPopoutManager();
    const layoutId = layout.getLayoutId();
    const latestLayout = React.useRef(layout);
    latestLayout.current = layout;

    // the core owns the window: open it while the layout is rendered (idempotent; a release is
    // deferred, so a StrictMode remount keeps the same window)
    React.useLayoutEffect(() => {
        manager.open(latestLayout.current);
        return () => manager.release(layoutId);
    }, [manager, layoutId]);

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

interface PopoutLayoutProps extends PopoutWindowProps {
    engine: LayoutEngine;
}

/** the root of a window layout, inside the popout document */
function PopoutLayout({ layout, engine, rest, children }: PopoutLayoutProps) {
    const { setLayer } = useDockableContext("Popout");
    const layoutId = layout.getLayoutId();
    engine.prepare(layout.getPath());

    const ref = React.useCallback(
        (element: HTMLElement | null) => {
            if (!element) {
                return;
            }
            engine.attachRoot(element);
            // the window's panels are positioned in this element
            setLayer(layoutId, { layoutId, element, engine });
            return () => {
                engine.detachRoot();
                setLayer(layoutId, null);
            };
        },
        [engine, layoutId, setLayer],
    );

    // the measure-and-position cycle of the window layout, after every commit
    React.useLayoutEffect(() => {
        engine.sync();
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
                "layout-path": layout.getPath() || `/${layoutId}`,
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

// Behaviour adapted from FlexLayout (https://github.com/caplin/FlexLayout), src/view/layout/LayoutInternal.tsx (the measure cycle and document key handling);
// the markup and class names are not copied. Copyright (c) 2017 Caplin Systems Ltd. MIT licence,
// see LICENSE.
import {
    type AnyTypes,
    createLayoutEngine,
    type DockableTypes,
    type KeyMap,
    MAIN_LAYOUT,
    type Model,
    matchesKey,
    type OnExternalDrag,
    type OpenWindow,
    type PopoutCallback,
    resolveKeyMap,
    type WindowLayout,
} from "@fragiola/dockable";
import * as React from "react";
import {
    DockableContext,
    type DockableContextValue,
    eraseEngine,
    eraseModel,
    LayoutContext,
    ModelContext,
} from "./context";
import { DragGroupContext } from "./DragGroup";
import { useDragState, useIndicator } from "./hooks";
import {
    type DivPrimitiveProps,
    dataAttributes,
    useRenderElement,
} from "./utils/useRender";

export interface RootState {
    /** a tabset of the main layout is maximized */
    maximized: boolean;
    /** a node of this layout is being dragged */
    dragging: boolean;
    /** the drag is over a target of the main layout that a drop rule refused */
    refused: boolean;
}

export interface RootProps<T extends DockableTypes = AnyTypes>
    extends DivPrimitiveProps<RootState> {
    /**
     * the layout model. Its middleware (`model.use`) sees every command the layout runs, and its
     * listeners (`model.subscribe`) every change; a new state never needs a new model
     * (`layout.load`). A new model identity creates a new engine.
     */
    model: Model<T>;
    /** keyboard bindings, merged over `defaultKeyMap` */
    keyMap?: KeyMap | undefined;
    /** true (default) to resize live while dragging a splitter; false to preview and commit on release */
    realtimeResize?: boolean | undefined;
    /** seconds a view may take to animate the drop indicator (exposed as data; default 0.3) */
    tabDragSpeed?: number | undefined;
    /** the popout host page (default `"popout.html"`); the window layout's id is passed as `?id=` */
    popoutURL?: string | undefined;
    /** whether window layouts open as popouts; default: a desktop pointer is present */
    supportsPopout?: boolean | undefined;
    /** a popout document's title; with none, the host page's title is kept */
    popoutTitle?: ((layout: WindowLayout<T>) => string | undefined) | undefined;
    /** a popout document is ready, before its content renders */
    onPopoutOpen?: PopoutCallback<T> | undefined;
    /** a popout window is closing (its tabs dock back into the main layout) */
    onPopoutClose?: PopoutCallback<T> | undefined;
    /** opens a popout's native window (default: the main window's `open`) */
    openWindow?: OpenWindow | undefined;
    /**
     * copies the main document's `<html>` and `<body>` attributes into each popout and keeps them
     * in sync (a theme class, `data-theme`, …): `true` copies them all (except `style` and `id`),
     * a list copies those names. Default: only `lang` and `dir`.
     */
    popoutMirrorRoot?: boolean | readonly string[] | undefined;
    /**
     * accepts a drag that did not start in a layout (files, links, text, another library's
     * element) as a new tab: return `{ tab, onDrop? }`, or `undefined` to ignore it. Called when
     * the drag enters the layout, when only `event.dataTransfer.types` is readable; read the data in
     * `onDrop`. A native drag that starts in the layout's own content (selected text, a list of
     * your own) is the content's: it is not asked about.
     */
    onExternalDrag?: OnExternalDrag<T> | undefined;
    children?: React.ReactNode;
}

/**
 * The layout's root: owns the engine for `model`, attaches it to the rendered element (the
 * containing block the panels are positioned in), runs the measure-and-position cycle after
 * every commit and re-renders when the engine asks.
 */
export function Root<T extends DockableTypes = AnyTypes>(props: RootProps<T>) {
    const {
        model: modelProp,
        keyMap,
        realtimeResize,
        tabDragSpeed,
        popoutURL,
        supportsPopout,
        popoutTitle,
        onPopoutOpen,
        onPopoutClose,
        openWindow,
        popoutMirrorRoot,
        onExternalDrag,
        children,
        ...rest
    } = props;
    const dragGroup = React.useContext(DragGroupContext);
    // DOM ids and window names unique on the page, and the same on the server and the client
    const idScope = `${React.useId().replace(/[^\w-]/g, "")}-`;
    const engineForModel = React.useMemo(
        () => createLayoutEngine({ model: modelProp, idScope }),
        [modelProp, idScope],
    );
    engineForModel.adapter.setOptions({
        realtimeResize,
        tabDragSpeed,
        onExternalDrag,
        dragGroup: dragGroup?.group,
        popout: {
            popoutURL,
            supportsPopout,
            mirrorRoot: popoutMirrorRoot,
            openWindow,
            title: popoutTitle,
            onPopoutOpen,
            onPopoutClose,
        },
    });
    // the parts below work on the erased registry; the typed surface is their props
    const model = eraseModel(modelProp);
    const engine = eraseEngine(engineForModel);
    // leave the group when this root unmounts or its engine is replaced (a new model), so the group
    // never reaches a layout that is gone; the setup re-joins after a StrictMode remount
    React.useEffect(() => dragGroup?.group.join(engine), [dragGroup, engine]);
    const dragState = useDragState();
    const refused = useIndicator(engine, (indicator) => indicator.refused);
    const revision = React.useSyncExternalStore(
        engine.adapter.subscribe,
        engine.adapter.getSnapshot,
        engine.adapter.getSnapshot,
    );
    engine.adapter.prepare();

    const [rootElement, setRootElement] = React.useState<HTMLElement | null>(
        null,
    );
    const rootRef = React.useCallback(
        (element: HTMLElement | null) => {
            if (!element) {
                return;
            }
            // attached in the commit, before any panel renders and creates a moveable element
            engine.adapter.attachRoot(element);
            setRootElement(element);
            return () => {
                engine.adapter.detachRoot();
                setRootElement(null);
            };
        },
        [engine],
    );

    // the measure-and-position cycle, after every commit (children registered their elements
    // during the commit, before this effect)
    React.useLayoutEffect(() => {
        engine.run("measure-and-position");
    });

    const resolvedKeyMap = React.useMemo(() => resolveKeyMap(keyMap), [keyMap]);

    // from anywhere in the document (tab content included): the focusNextTabset and
    // focusPreviousTabset keys move focus between tabsets, else the closeOverlayBorder key closes
    // an open overlay border; a press elsewhere in the layout closes it too
    const { focusNextTabset, focusPreviousTabset, closeOverlayBorder } =
        resolvedKeyMap;
    React.useEffect(() => {
        if (!rootElement) {
            return;
        }
        const doc = rootElement.ownerDocument;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.defaultPrevented) {
                return; // content that handled the key keeps it
            }
            const direction = matchesKey(event, focusNextTabset)
                ? "next"
                : matchesKey(event, focusPreviousTabset)
                  ? "previous"
                  : undefined;
            if (direction && engine.run("focus-tabset", { direction }).ok) {
                event.preventDefault();
            } else {
                engine.adapter.handleOverlayKeyDown(event, closeOverlayBorder);
            }
        };
        const onPointerDown = (event: PointerEvent) => {
            engine.adapter.handleOverlayPointerDown(event);
        };
        // capture: splitters and buttons stop the propagation of their presses
        doc.addEventListener("pointerdown", onPointerDown, true);
        doc.addEventListener("keydown", onKeyDown);
        return () => {
            doc.removeEventListener("pointerdown", onPointerDown, true);
            doc.removeEventListener("keydown", onKeyDown);
        };
    }, [
        engine,
        rootElement,
        focusNextTabset,
        focusPreviousTabset,
        closeOverlayBorder,
    ]);

    const [windowLayers, setWindowLayers] = React.useState<
        ReadonlyMap<string, HTMLElement>
    >(new Map());
    const setLayer = React.useCallback(
        (layoutId: string, element: HTMLElement | null) => {
            setWindowLayers((prev) => {
                if ((prev.get(layoutId) ?? null) === element) {
                    return prev;
                }
                const next = new Map(prev);
                if (element === null) {
                    next.delete(layoutId);
                } else {
                    next.set(layoutId, element);
                }
                return next;
            });
        },
        [],
    );
    const layers = React.useMemo(() => {
        const all = new Map(windowLayers);
        if (rootElement) {
            // the main layout's panels are positioned in the root itself
            all.set(MAIN_LAYOUT, rootElement);
        }
        return all;
    }, [windowLayers, rootElement]);

    const context = React.useMemo<DockableContextValue>(
        () => ({
            engine,
            model,
            revision,
            keyMap: resolvedKeyMap,
            layers,
            setLayer,
        }),
        [engine, model, revision, resolvedKeyMap, layers, setLayer],
    );
    const layoutContext = React.useMemo(
        () => ({ layoutId: MAIN_LAYOUT, engine }),
        [engine],
    );

    const state: RootState = {
        maximized:
            model.get("maximized-tabset", {
                layoutId: MAIN_LAYOUT,
            }) !== undefined,
        dragging: dragState !== undefined && dragState.mainEngine === engine,
        refused,
    };
    const element = useRenderElement("div", rest, {
        state,
        ref: rootRef,
        props: {
            ...dataAttributes({
                "layout-path": "/layout",
                maximized: state.maximized,
                dragging: state.dragging,
                "drop-refused": state.refused,
            }),
            children,
        },
        // the containing block the panels are absolutely positioned in
        style: { position: "relative" },
    });

    return (
        <ModelContext.Provider value={model}>
            <DockableContext.Provider value={context}>
                <LayoutContext.Provider value={layoutContext}>
                    {element}
                </LayoutContext.Provider>
            </DockableContext.Provider>
        </ModelContext.Provider>
    );
}

// Behaviour adapted from FlexLayout (https://github.com/caplin/FlexLayout), src/view/layout/LayoutInternal.tsx (the measure cycle and document key handling);
// the markup and class names are not copied. Copyright (c) 2017 Caplin Systems Ltd. MIT licence,
// see LICENSE.
import {
    createLayoutEngine,
    type IKeyMap,
    Model,
    matchesKey,
    type OnAction,
    type OnExternalDrag,
    type OnModelChange,
    type PopoutCallback,
    type PopoutClosePolicy,
    resolveKeyMap,
} from "@fragiola/dockable";
import * as React from "react";
import {
    DockableContext,
    type DockableContextValue,
    type GetLabel,
    LayoutContext,
    type PanelLayer,
    type PopoutHooks,
} from "./context";
import { useDragState } from "./hooks";
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
}

export interface RootProps extends DivPrimitiveProps<RootState> {
    /** the layout model; a new model identity (e.g. an undo/redo swap) creates a new engine */
    model: Model;
    /** intercepts every action: return it (or a replacement) to apply it, `undefined` to veto */
    onAction?: OnAction | undefined;
    /** called after the model applied an action */
    onModelChange?: OnModelChange | undefined;
    /**
     * resolves label keys to text (accessible names); with no resolver the primitives render
     * no text of their own
     */
    getLabel?: GetLabel | undefined;
    /** keyboard bindings, merged over `defaultKeyMap` */
    keyMap?: IKeyMap | undefined;
    /** true (default) to resize live while dragging a splitter; false to preview and commit on release */
    realtimeResize?: boolean | undefined;
    /** seconds a view may take to animate the drop indicator (exposed as data; default 0.3) */
    tabDragSpeed?: number | undefined;
    /** the popout host page (default `"popout.html"`); the window layout's id is passed as `?id=` */
    popoutURL?: string | undefined;
    /** whether window layouts open as popouts; default: a desktop pointer is present */
    supportsPopout?: boolean | undefined;
    /** what closing a popout window does; default `"dock"` (its tabs move back to the main layout) */
    popoutClosePolicy?: PopoutClosePolicy | undefined;
    /** a popout document is ready, before its content renders */
    onPopoutOpen?: PopoutCallback | undefined;
    /** a popout window is closing */
    onPopoutClose?: PopoutCallback | undefined;
    /**
     * accepts a drag that did not start in a layout (files, links, text, another library's
     * element) as a new tab: return `{ json, onDrop? }`, or `undefined` to ignore it. Called on
     * the first `dragenter`, when only `event.dataTransfer.types` is readable; read the data in
     * `onDrop`.
     */
    onExternalDrag?: OnExternalDrag | undefined;
    children?: React.ReactNode;
}

/**
 * The layout's root: owns the engine for `model`, attaches it to the rendered element (the
 * containing block the panels are positioned in), runs the measure-and-position cycle after
 * every commit and re-renders when the engine asks.
 */
export function Root(props: RootProps) {
    const {
        model,
        onAction,
        onModelChange,
        getLabel,
        keyMap,
        realtimeResize,
        tabDragSpeed,
        popoutURL,
        supportsPopout,
        popoutClosePolicy,
        onPopoutOpen,
        onPopoutClose,
        onExternalDrag,
        children,
        ...rest
    } = props;
    const popoutHooks = React.useRef<PopoutHooks>({});
    const engine = React.useMemo(() => createLayoutEngine({ model }), [model]);
    engine.setOptions({
        onAction,
        onModelChange,
        realtimeResize,
        tabDragSpeed,
        onExternalDrag,
        popout: {
            popoutURL,
            supportsPopout,
            closePolicy: popoutClosePolicy,
            title: (layout) => popoutHooks.current.title?.(layout),
            onPopoutOpen: (layout, win, doc) => {
                onPopoutOpen?.(layout, win, doc);
                popoutHooks.current.onOpen?.(layout, win, doc);
            },
            onPopoutClose: (layout, win, doc) => {
                onPopoutClose?.(layout, win, doc);
                popoutHooks.current.onClose?.(layout, win, doc);
            },
        },
    });
    const dragState = useDragState();
    const revision = React.useSyncExternalStore(
        engine.subscribe,
        engine.getSnapshot,
        engine.getSnapshot,
    );
    engine.prepare();

    const [rootElement, setRootElement] = React.useState<HTMLElement | null>(
        null,
    );
    const rootRef = React.useCallback(
        (element: HTMLElement | null) => {
            if (!element) {
                return;
            }
            // attached in the commit, before any panel renders and creates a moveable element
            engine.attachRoot(element);
            setRootElement(element);
            return () => {
                engine.detachRoot();
                setRootElement(null);
            };
        },
        [engine],
    );

    // the measure-and-position cycle, after every commit (children registered their elements
    // during the commit, before this effect)
    React.useLayoutEffect(() => {
        engine.sync();
    });

    const resolvedKeyMap = React.useMemo(() => resolveKeyMap(keyMap), [keyMap]);

    // the focusNextTabset/focusPreviousTabset keys move focus between tabsets, from anywhere in
    // the document (including inside tab content)
    const { focusNextTabset, focusPreviousTabset } = resolvedKeyMap;
    React.useEffect(() => {
        if (!rootElement || (!focusNextTabset && !focusPreviousTabset)) {
            return;
        }
        const doc = rootElement.ownerDocument;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.defaultPrevented) {
                return; // content that handled the key keeps it
            }
            const delta = matchesKey(event, focusNextTabset)
                ? 1
                : matchesKey(event, focusPreviousTabset)
                  ? -1
                  : 0;
            if (delta !== 0 && engine.focusAdjacentTabset(delta)) {
                event.preventDefault();
            }
        };
        doc.addEventListener("keydown", onKeyDown);
        return () => doc.removeEventListener("keydown", onKeyDown);
    }, [engine, rootElement, focusNextTabset, focusPreviousTabset]);

    const [extraLayers, setExtraLayers] = React.useState<
        ReadonlyMap<string, PanelLayer>
    >(new Map());
    const setLayer = React.useCallback(
        (layoutId: string, layer: PanelLayer | null) => {
            setExtraLayers((prev) => {
                if (
                    layer === null
                        ? !prev.has(layoutId)
                        : prev.get(layoutId)?.element === layer.element
                ) {
                    return prev;
                }
                const next = new Map(prev);
                if (layer === null) {
                    next.delete(layoutId);
                } else {
                    next.set(layoutId, layer);
                }
                return next;
            });
        },
        [],
    );
    const layers = React.useMemo(() => {
        const all = new Map(extraLayers);
        if (rootElement) {
            // the main layout's panels are positioned in the root itself
            all.set(Model.MAIN_LAYOUT_ID, {
                layoutId: Model.MAIN_LAYOUT_ID,
                element: rootElement,
                engine,
            });
        }
        return all;
    }, [extraLayers, rootElement, engine]);

    const context = React.useMemo<DockableContextValue>(
        () => ({
            engine,
            model,
            revision,
            getLabel,
            keyMap: resolvedKeyMap,
            layers,
            setLayer,
            popoutHooks,
        }),
        [engine, model, revision, getLabel, resolvedKeyMap, layers, setLayer],
    );
    const layoutContext = React.useMemo(
        () => ({ layoutId: Model.MAIN_LAYOUT_ID, engine }),
        [engine],
    );

    const state: RootState = {
        maximized: model.getMaximizedTabset(Model.MAIN_LAYOUT_ID) !== undefined,
        dragging: dragState !== undefined && dragState.mainEngine === engine,
    };
    const element = useRenderElement("div", rest, {
        state,
        ref: rootRef,
        props: {
            ...dataAttributes({
                "layout-path": "/layout",
                maximized: state.maximized,
                dragging: state.dragging,
            }),
            children,
        },
        // the containing block the panels are absolutely positioned in
        style: { position: "relative" },
    });

    return (
        <DockableContext.Provider value={context}>
            <LayoutContext.Provider value={layoutContext}>
                {element}
            </LayoutContext.Provider>
        </DockableContext.Provider>
    );
}

import {
    createLayoutEngine,
    type IKeyMap,
    Model,
    matchesKey,
    type OnAction,
    type OnModelChange,
    resolveKeyMap,
} from "@fragiola/dockable";
import * as React from "react";
import {
    DockableContext,
    type DockableContextValue,
    type GetLabel,
    LayoutContext,
    type PanelLayer,
} from "./context";
import {
    type DivPrimitiveProps,
    dataAttributes,
    useRenderElement,
} from "./utils/useRender";

export interface RootState {
    /** a tabset of the main layout is maximized */
    maximized: boolean;
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
        children,
        ...rest
    } = props;
    const engine = React.useMemo(() => createLayoutEngine({ model }), [model]);
    engine.setOptions({ onAction, onModelChange, realtimeResize });
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
        }),
        [engine, model, revision, getLabel, resolvedKeyMap, layers, setLayer],
    );
    const layoutContext = React.useMemo(
        () => ({ layoutId: Model.MAIN_LAYOUT_ID, engine }),
        [engine],
    );

    const state: RootState = {
        maximized: model.getMaximizedTabset(Model.MAIN_LAYOUT_ID) !== undefined,
    };
    const element = useRenderElement("div", rest, {
        state,
        ref: rootRef,
        props: {
            ...dataAttributes({
                "layout-path": "/layout",
                maximized: state.maximized,
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

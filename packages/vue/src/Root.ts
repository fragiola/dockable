// Behaviour adapted from FlexLayout (https://github.com/caplin/FlexLayout), src/view/layout/LayoutInternal.tsx (the measure cycle and document key handling);
// the markup and class names are not copied. Copyright (c) 2017 Caplin Systems Ltd. MIT licence,
// see LICENSE.
import {
    type AnyTypes,
    createLayoutEngine,
    type DockableTypes,
    type KeyMap,
    type LayoutEngine,
    MAIN_LAYOUT,
    type Model,
    type OnExternalDrag,
    type OpenWindow,
    type PopoutCallback,
    type WindowLayout,
} from "@fragiola/dockable";
import {
    computed,
    defineComponent,
    h,
    inject,
    nextTick,
    onMounted,
    onUnmounted,
    onUpdated,
    provide,
    shallowRef,
    useId,
    watch,
} from "vue";
import { useDragState, useIndicator } from "./composables";
import {
    type DockableContextValue,
    DockableKey,
    eraseEngine,
    eraseModel,
    LayoutKey,
    ModelKey,
} from "./context";
import { DragGroupKey } from "./DragGroup";
import {
    type DockableComponent,
    definePrimitive,
    type PrimitiveProps,
    type SlotFunction,
} from "./utils/primitive";
import {
    dataAttributes,
    elementRef,
    type RenderSlot,
    renderElement,
    useExternal,
} from "./utils/render";

export interface RootState {
    /** a tabset of the main layout is maximized */
    maximized: boolean;
    /** a node of this layout is being dragged */
    dragging: boolean;
    /** the drag is over a target of the main layout that a drop rule refused */
    refused: boolean;
}

export interface RootProps<T extends DockableTypes = AnyTypes>
    extends PrimitiveProps {
    /**
     * the layout model. Its middleware (`model.use`) sees every command the layout runs, and its
     * listeners (`model.subscribe`) every change; a new state never needs a new model
     * (`layout.load`). Another model remounts the layout (a new engine).
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
     * in sync (a theme class, `data-theme`, …): `true` copies them all (except `style`, `id` and
     * `dir`), a list copies those names. Default: only `lang`.
     */
    popoutMirrorRoot?: boolean | readonly string[] | undefined;
    /**
     * accepts a drag that did not start in a layout (files, links, text, another library's
     * element) as a new tab: return `{ tab, onDrop? }`, or `undefined` to ignore it
     */
    onExternalDrag?: OnExternalDrag<T> | undefined;
}

export interface RootSlots extends RenderSlot<RootState> {
    /** the layout: a `Dockable.Row` (or `Dockable.Borders`), `Dockable.Panels`, indicators, … */
    default?: SlotFunction<Record<never, never>>;
}

const ROOT_PROPS = [
    "model",
    "keyMap",
    "realtimeResize",
    "tabDragSpeed",
    "popoutURL",
    "supportsPopout",
    "popoutTitle",
    "onPopoutOpen",
    "onPopoutClose",
    "openWindow",
    "popoutMirrorRoot",
    "onExternalDrag",
    "as",
] as const satisfies readonly (keyof RootProps)[];

/** a key per model: another model remounts the layout, with a new engine */
const modelKeys = new WeakMap<object, number>();
let nextModelKey = 0;
function keyOfModel(model: object): number {
    let key = modelKeys.get(model);
    if (key === undefined) {
        key = nextModelKey++;
        modelKeys.set(model, key);
    }
    return key;
}

/** The root of one model's layout: it owns the engine, so it lives as long as the model does. */
const RootLayout = definePrimitive<RootProps, RootSlots>(
    "RootLayout",
    ROOT_PROPS,
    (props, { attrs, slots }) => {
        const dragGroup = inject(DragGroupKey, null);
        // DOM ids and window names unique on the page, and the same on the server and the client
        const idScope = `${useId().replace(/[^\w-]/g, "")}-`;
        const engine = eraseEngine(
            createLayoutEngine({ model: props.model, idScope }),
        );
        const model = eraseModel(props.model);
        const revision = useExternal(
            engine.adapter.subscribe,
            engine.adapter.getSnapshot,
        );
        const dragState = useDragState();
        const refused = useIndicator(engine, (indicator) => indicator.refused);

        const rootElement = shallowRef<HTMLElement | null>(null);
        const windowLayers = shallowRef<ReadonlyMap<string, HTMLElement>>(
            new Map(),
        );
        const layers = computed(() => {
            const all = new Map(windowLayers.value);
            if (rootElement.value) {
                // the main layout's panels are positioned in the root itself
                all.set(MAIN_LAYOUT, rootElement.value);
            }
            return all;
        });
        const setLayer = (layoutId: string, element: HTMLElement | null) => {
            const previous = windowLayers.value;
            if ((previous.get(layoutId) ?? null) === element) {
                return;
            }
            const next = new Map(previous);
            if (element === null) {
                next.delete(layoutId);
            } else {
                next.set(layoutId, element);
            }
            windowLayers.value = next;
        };

        // the measure-and-position cycle, once every part of the flush has rendered and
        // registered its elements (Vue renders a part on its own, after its parent)
        const pending = new Set<LayoutEngine>();
        const scheduleMeasure = (target: LayoutEngine) => {
            if (pending.size === 0) {
                void nextTick(() => {
                    const engines = [...pending];
                    pending.clear();
                    for (const each of engines) {
                        each.run("measure-and-position");
                    }
                });
            }
            pending.add(target);
        };
        onMounted(() => scheduleMeasure(engine));
        onUpdated(() => scheduleMeasure(engine));

        const rootRef = elementRef((element) => {
            // attached before any panel renders and creates a moveable element (`Dockable.Panels`
            // waits for the root)
            engine.adapter.attachRoot(element);
            rootElement.value = element;
            return () => {
                engine.adapter.detachRoot();
                rootElement.value = null;
            };
        });

        // from anywhere in the document (tab content included): the key map's tabset focus keys
        // and overlay close key (the core's rules); a press elsewhere in the layout closes an
        // open overlay border
        watch(
            rootElement,
            (element, _previous, onCleanup) => {
                if (!element) {
                    return;
                }
                const doc = element.ownerDocument;
                const onKeyDown = (event: KeyboardEvent) => {
                    engine.adapter.handleDocumentKeyDown(event);
                };
                const onPointerDown = (event: PointerEvent) => {
                    engine.adapter.handleOverlayPointerDown(event);
                };
                // capture: splitters and buttons stop the propagation of their presses
                doc.addEventListener("pointerdown", onPointerDown, true);
                doc.addEventListener("keydown", onKeyDown);
                onCleanup(() => {
                    doc.removeEventListener("pointerdown", onPointerDown, true);
                    doc.removeEventListener("keydown", onKeyDown);
                });
            },
            { flush: "sync" },
        );

        // leave the group when this root unmounts, so the group never reaches a layout that is gone
        let leave: (() => void) | undefined;
        onMounted(() => {
            leave = dragGroup?.group.join(engine);
        });
        onUnmounted(() => leave?.());

        const context: DockableContextValue = {
            engine,
            model,
            revision,
            layers,
            setLayer,
            scheduleMeasure,
        };
        provide(DockableKey, context);
        provide(LayoutKey, { layoutId: MAIN_LAYOUT, engine });
        provide(ModelKey, model);

        return () => {
            engine.adapter.setOptions({
                realtimeResize: props.realtimeResize,
                tabDragSpeed: props.tabDragSpeed,
                onExternalDrag: props.onExternalDrag,
                dragGroup: dragGroup?.group,
                keyMap: props.keyMap,
                popout: {
                    popoutURL: props.popoutURL,
                    supportsPopout: props.supportsPopout,
                    mirrorRoot: props.popoutMirrorRoot,
                    openWindow: props.openWindow,
                    title: props.popoutTitle,
                    onPopoutOpen: props.onPopoutOpen,
                    onPopoutClose: props.onPopoutClose,
                },
            });
            revision.value;
            // re-rendered (and measured) once the root attaches, as the panels can now render
            rootElement.value;
            engine.adapter.prepare();
            const drag = dragState.value;
            const state: RootState = {
                maximized:
                    model.get("maximized-tabset", { layoutId: MAIN_LAYOUT }) !==
                    undefined,
                dragging: drag !== undefined && drag.mainEngine === engine,
                refused: refused.value,
            };
            return renderElement({
                tag: "div",
                as: props.as,
                attrs,
                render: slots.render,
                state,
                ref: rootRef,
                props: dataAttributes({
                    "layout-path": "/layout",
                    maximized: state.maximized,
                    dragging: state.dragging,
                    "drop-refused": state.refused,
                }),
                // the containing block the panels are absolutely positioned in
                style: { position: "relative" },
                children: () => slots.default?.({}),
            });
        };
    },
);

/**
 * The layout's root: owns the engine for `model`, attaches it to the rendered element (the
 * containing block the panels are positioned in), runs the measure-and-position cycle after
 * every render and re-renders when the engine asks. Another `model` remounts the layout.
 */
export const Root: DockableComponent<RootProps, RootSlots> = defineComponent({
    name: "DockableRoot",
    inheritAttrs: false,
    props: [...ROOT_PROPS],
    setup(props, { attrs, slots }) {
        return () =>
            h(
                RootLayout,
                {
                    ...attrs,
                    ...props,
                    key: keyOfModel(props.model as object),
                },
                slots,
            );
    },
}) as unknown as DockableComponent<RootProps, RootSlots>;

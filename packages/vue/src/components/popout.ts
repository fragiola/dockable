// Behaviour adapted from FlexLayout (https://github.com/caplin/FlexLayout), src/view/layout/FloatingWindowContainer.tsx and src/view/PopoutWindow.tsx (per-window rendering);
// the markup and class names are not copied. Copyright (c) 2017 Caplin Systems Ltd. MIT licence,
// see LICENSE.
import type {
    AnyTypes,
    DockableTypes,
    LayoutEngine,
    WindowLayout,
} from "@fragiola/dockable";
import {
    defineComponent,
    Fragment,
    h,
    onMounted,
    onUpdated,
    type PropType,
    provide,
    Teleport,
    type VNodeChild,
} from "vue";
import { LayoutKey, useDockableContext } from "../context";
import {
    type DockableComponent,
    definePrimitive,
    type PrimitiveProps,
    type SlotFunction,
} from "../utils/primitive";
import {
    dataAttributes,
    elementRef,
    type RenderSlot,
    renderElement,
    useExternal,
} from "../utils/render";

export interface PopoutState {
    /** the id of the window layout */
    layoutId: string;
}

export type PopoutProps = PrimitiveProps;

export interface PopoutSlots<T extends DockableTypes = AnyTypes>
    extends RenderSlot<PopoutState> {
    /** renders a window layout, usually `<Dockable.Row v-slot="{ node }">…</Dockable.Row>` */
    default?: SlotFunction<{ layout: WindowLayout<T> }>;
}

/** a key per engine, so a window that gets another engine remounts its layout */
const engineKeys = new WeakMap<LayoutEngine, number>();
let nextEngineKey = 0;
function keyOfEngine(engine: LayoutEngine): number {
    let key = engineKeys.get(engine);
    if (key === undefined) {
        key = nextEngineKey++;
        engineKeys.set(engine, key);
    }
    return key;
}

/** the root of a window layout, inside the popout document */
const PopoutLayout = defineComponent({
    name: "DockablePopoutLayout",
    inheritAttrs: false,
    props: {
        layout: { type: Object as PropType<WindowLayout>, required: true },
        engine: { type: Object as PropType<LayoutEngine>, required: true },
        as: { type: [String, Object, Function] as PropType<PopoutProps["as"]> },
        attrs: {
            type: Object as PropType<Record<string, unknown>>,
            required: true,
        },
        content: {
            type: Function as PropType<(layout: WindowLayout) => VNodeChild>,
            required: true,
        },
        renderSlot: {
            type: Function as PropType<RenderSlot<PopoutState>["render"]>,
        },
    },
    setup(props) {
        const { setLayer, revision, scheduleMeasure } =
            useDockableContext("Popout");
        const engine = props.engine;
        const layoutId = props.layout.id;
        provide(LayoutKey, { layoutId, engine });
        const ref = elementRef((element) => {
            engine.adapter.attachRoot(element);
            // the window's panels are positioned in this element
            setLayer(layoutId, element);
            return () => {
                engine.adapter.detachRoot();
                setLayer(layoutId, null);
            };
        });
        // the measure-and-position cycle of the window layout, after every render
        onMounted(() => scheduleMeasure(engine));
        onUpdated(() => scheduleMeasure(engine));
        return () => {
            revision.value;
            engine.adapter.prepare();
            const state: PopoutState = { layoutId };
            return renderElement({
                tag: "div",
                as: props.as,
                attrs: props.attrs,
                render: props.renderSlot,
                state,
                ref,
                props: dataAttributes({
                    "layout-path":
                        engine.get("layout-path-by", {
                            nodeId: props.layout.root.id,
                        }) || `/${layoutId}`,
                }),
                // fills the popout window and is the containing block its panels are positioned in
                style: { position: "absolute", inset: 0 },
                children: () => props.content(props.layout),
            });
        };
    },
});

/**
 * The popout windows. Place it once, directly under `Dockable.Root` (typed with
 * `typedDockable<Types>().Popout`). The core keeps a native window open for every window layout
 * of the state; once one is ready (styles copied), the default slot is teleported into it. A
 * node-less `Dockable.Row` inside renders that layout's root row, and panels of tabs in that
 * layout are positioned in the window. Pop a tab out with `tab.popout`.
 */
export const Popout: DockableComponent<PopoutProps, PopoutSlots> =
    definePrimitive<PopoutProps, PopoutSlots>(
        "Popout",
        ["as"],
        (props, { attrs, slots }) => {
            const {
                engine,
                model: erased,
                revision,
            } = useDockableContext("Popout");
            const model = erased;
            const manager = engine.adapter.getPopoutManager();
            const windows = useExternal(manager.subscribe, manager.getSnapshot);
            return () => {
                revision.value;
                windows.value;
                return h(
                    Fragment,
                    model.get("windows").map((layout) => {
                        // the core owns the window (it opens one per window layout while the root
                        // is attached); nothing renders until it is ready
                        const contentRoot = manager.getContentRoot(layout.id);
                        const layoutEngine = manager.getLayoutEngine(layout.id);
                        if (!contentRoot || !layoutEngine) {
                            return h(Fragment, { key: layout.id }, []);
                        }
                        return h(
                            Teleport,
                            { to: contentRoot, key: layout.id },
                            [
                                h(PopoutLayout, {
                                    // a new engine for the window is a new layout root
                                    key: keyOfEngine(layoutEngine),
                                    layout,
                                    engine: layoutEngine,
                                    as: props.as,
                                    attrs,
                                    renderSlot: slots.render,
                                    content: (current: WindowLayout) =>
                                        slots.default?.({ layout: current }),
                                }),
                            ],
                        );
                    }),
                );
            };
        },
    );

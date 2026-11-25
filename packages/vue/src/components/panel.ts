// Behaviour adapted from FlexLayout (https://github.com/caplin/FlexLayout), src/view/Tab.tsx and src/view/TabContentRenderer.tsx (panel container and content portal);
// the markup and class names are not copied. Copyright (c) 2017 Caplin Systems Ltd. MIT licence,
// see LICENSE.
import {
    type AnyTypes,
    type DockableTypes,
    MAIN_LAYOUT,
    type TabOf,
} from "@fragiola/dockable";
import {
    Fragment,
    h,
    inject,
    onBeforeUnmount,
    onMounted,
    onUpdated,
    shallowRef,
    Teleport,
} from "vue";
import { useDockableContext, useLayoutContext } from "../context";
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
} from "../utils/render";
import { DragGroupKey } from "./drag-group";

export interface PanelState {
    /** the tab is its tabset's selected tab */
    selected: boolean;
    /** the panel is shown (selected, and not hidden by another tabset being maximized) */
    visible: boolean;
    /** the tab's tabset is its layout's active tabset (always false in a border) */
    tabsetActive: boolean;
}

export interface PanelProps<T extends DockableTypes = AnyTypes>
    extends PrimitiveProps {
    node: TabOf<T>;
    /** the content element scrolls its overflow (default `true`); `false` clips it */
    scrollable?: boolean | undefined;
    /**
     * remount the content when the tab moves to another window (default `false`: the same
     * content moves, keeping its state). For content bound to its document (an iframe, a canvas
     * context).
     */
    remountInWindow?: boolean | undefined;
}

export interface PanelSlots extends RenderSlot<PanelState> {
    /** the tab's content */
    default?: SlotFunction<Record<never, never>>;
}

/** the engine writes a panel's geometry and display: no consumer style sets them */
const ENGINE_KEYS = [
    "position",
    "inset",
    "left",
    "top",
    "right",
    "bottom",
    "width",
    "height",
    "display",
] as const;

/** A stable key per moveable element, for a drag group's content host. */
const moveableKeys = new WeakMap<HTMLElement, string>();
let nextMoveableKey = 0;
function keyOfMoveable(element: HTMLElement): string {
    let key = moveableKeys.get(element);
    if (key === undefined) {
        key = `moveable-${nextMoveableKey++}`;
        moveableKeys.set(element, key);
    }
    return key;
}

/**
 * A tab's content panel (`role="tabpanel"`). Renders two teleports:
 * - the panel element, into the panel layer of the tab's current layout; the engine positions it
 *   over the tabset's content area and shows or hides it (structural style only);
 * - the content (the default slot), into the tab's moveable element, which the engine moves into
 *   whichever panel element is current.
 *
 * The content's place in the Vue tree never changes (it always lives under `Dockable.Panels`), so
 * moving a tab to another tabset or another window re-parents DOM without remounting the content.
 */
export const Panel: DockableComponent<PanelProps, PanelSlots> = definePrimitive<
    PanelProps,
    PanelSlots
>(
    "Panel",
    ["node", "scrollable", "remountInWindow", "as"],
    (props, { attrs, slots }) => {
        const dockable = useDockableContext("Panel");
        const layout = useLayoutContext("Panel");
        const {
            engine: mainEngine,
            model,
            layers,
            revision,
            keyMap,
        } = dockable;
        const dragGroup = inject(DragGroupKey, null);
        const id = () => props.node.id;
        const scrollable = () => props.scrollable !== false;
        const remountInWindow = () => props.remountInWindow === true;
        const layoutIdOf = () =>
            model.get("layout-id-by", { nodeId: id() }) ?? MAIN_LAYOUT;

        const panelElement = shallowRef<HTMLElement | null>(null);
        let lastPanel: HTMLElement | null = null;
        const ref = elementRef(
            (element) => {
                const tabId = id();
                const layoutEngine = mainEngine.adapter.engineOf(tabId);
                lastPanel = element;
                panelElement.value = element;
                layoutEngine.adapter.registerTabPanel(tabId, element);
                return () => {
                    if (panelElement.value === element) {
                        panelElement.value = null;
                    }
                    layoutEngine.adapter.registerTabPanel(tabId, null);
                };
            },
            () => [id(), mainEngine.adapter.engineOf(id())],
        );

        // move the content into the current panel element; with no panel element (the layout's
        // layer is not mounted yet) park it, so it stays in the document
        let attached: unknown[] = [];
        const sync = () => {
            const next = [
                id(),
                panelElement.value,
                scrollable(),
                remountInWindow(),
            ];
            if (next.every((value, i) => Object.is(value, attached[i]))) {
                return;
            }
            attached = next;
            if (panelElement.value) {
                mainEngine.adapter.attachMoveable(id(), panelElement.value, {
                    scrollable: scrollable(),
                });
            } else if (lastPanel) {
                mainEngine.adapter.releaseMoveable(id(), lastPanel, {
                    remountInWindow: remountInWindow(),
                });
            }
            dockable.scheduleMeasure(mainEngine.adapter.engineOf(id()));
        };

        // in a drag group, the content renders in the group's host, so it survives the tab moving
        // to another root; the panel hands over its context along with it. The host keys it by
        // the moveable element, which a transferred tab adopts: two models' tabs may share an id
        const owner = {};
        let groupKey: string | undefined;
        const register = () => {
            if (!dragGroup) {
                return;
            }
            const moveable = mainEngine.adapter.getMoveableElement(id());
            const key =
                keyOfMoveable(moveable) +
                (remountInWindow() ? `:${layoutIdOf()}` : "");
            if (groupKey !== undefined && groupKey !== key) {
                dragGroup.registry.remove(groupKey, owner);
            }
            groupKey = key;
            dragGroup.registry.set(key, {
                owner,
                container: moveable,
                render: () => slots.default?.({}),
                dockable,
                layout,
            });
        };

        onMounted(() => {
            sync();
            register();
        });
        onUpdated(() => {
            sync();
            register();
        });
        onBeforeUnmount(() => {
            // park the content so its DOM survives
            mainEngine.adapter.releaseMoveable(id(), lastPanel ?? undefined, {
                remountInWindow: remountInWindow(),
            });
            if (dragGroup && groupKey !== undefined) {
                dragGroup.registry.remove(groupKey, owner);
            }
        });

        const onPointerdown = () => {
            mainEngine.adapter.handlePanelPointerDown(id());
        };
        // the configured key (pressed anywhere within the tab content) returns focus to the tab
        // button
        const onKeydown = (event: KeyboardEvent) => {
            const panel = event.currentTarget as HTMLElement | null;
            if (
                panel &&
                mainEngine.adapter.handlePanelKeyDown(id(), event, panel)
            ) {
                event.stopPropagation();
            }
        };

        return () => {
            revision.value;
            keyMap.value;
            const tabId = id();
            const layoutId = layoutIdOf();
            const layer = layers.value.get(layoutId);
            const layoutEngine = mainEngine.adapter.engineOf(tabId);
            const selected = model.is("tab-selected", { tabId });
            // the engine's own rule, so the state always matches what it displays
            const visible = mainEngine.is("tab-panel-visible", { tabId });
            const tabsetActive = model.is("tab-in-active-tabset", { tabId });
            const state: PanelState = { selected, visible, tabsetActive };
            const focusToggleKey =
                mainEngine.adapter.getKeyMap().focusTabToggle;

            const panel = renderElement({
                tag: "div",
                as: props.as,
                attrs,
                render: slots.render,
                state,
                ref,
                props: {
                    id: mainEngine.get("tab-panel-dom-id-by", { tabId }),
                    role: "tabpanel",
                    "aria-labelledby": mainEngine.get("tab-button-dom-id-by", {
                        tabId,
                    }),
                    "aria-keyshortcuts":
                        mainEngine.adapter.getKeyShortcuts("panel"),
                    tabindex: -1,
                    ...dataAttributes({
                        "layout-path": layoutEngine.get("layout-path-by", {
                            nodeId: tabId,
                        }),
                        selected,
                        visible,
                        "tabset-active": tabsetActive,
                    }),
                    onPointerdown,
                    onKeydown: focusToggleKey ? onKeydown : undefined,
                },
                // absolute from first mount, so it never joins the layout's flow before the
                // engine positions it; the engine writes the geometry and the display
                style: { position: "absolute" },
                reserved: ENGINE_KEYS,
            });
            const moveable = mainEngine.adapter.getMoveableElement(tabId);
            // with remountInWindow the content is keyed by its layout, so it remounts when it
            // changes window
            const contentKey =
                tabId + (remountInWindow() ? `:${layoutId}` : "");
            return h(Fragment, [
                layer
                    ? h(Teleport, { to: layer, key: `panel:${layoutId}` }, [
                          panel,
                      ])
                    : null,
                dragGroup
                    ? null
                    : h(Teleport, { to: moveable, key: contentKey }, [
                          h(Fragment, { key: contentKey }, slots.default?.({})),
                      ]),
            ]);
        };
    },
    ["scrollable", "remountInWindow"],
);

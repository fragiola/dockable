// Behaviour adapted from FlexLayout (https://github.com/caplin/FlexLayout), src/view/Tab.tsx and src/view/TabContentRenderer.tsx (panel container and content portal);
// the markup and class names are not copied. Copyright (c) 2017 Caplin Systems Ltd. MIT licence,
// see LICENSE.
import {
    type AnyTypes,
    type DockableTypes,
    MAIN_LAYOUT,
    matchesKey,
    type TabOf,
    toAriaKeyShortcuts,
} from "@fragiola/dockable";
import * as React from "react";
import { createPortal } from "react-dom";
import {
    DockableContext,
    LayoutContext,
    ModelContext,
    useDockableContext,
} from "./context";
import { DragGroupContext } from "./DragGroup";
import {
    type DivPrimitiveProps,
    dataAttributes,
    useRenderElement,
} from "./utils/useRender";

export interface PanelState {
    /** the tab is its tabset's selected tab */
    selected: boolean;
    /** the panel is shown (selected, and not hidden by another tabset being maximized) */
    visible: boolean;
}

export interface PanelProps<T extends DockableTypes = AnyTypes>
    extends DivPrimitiveProps<PanelState> {
    node: TabOf<T>;
    /** the tab's content */
    children?: React.ReactNode;
    /** the content element scrolls its overflow (default `true`); `false` clips it */
    scrollable?: boolean | undefined;
    /**
     * remount the content when the tab moves to another window (default `false`: the same
     * content moves, keeping its state). For content bound to its document (an iframe, a canvas
     * context).
     */
    remountInWindow?: boolean | undefined;
}

/** style keys the engine owns on a panel: a consumer style never sets them */
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

function withoutEngineKeys(
    style: React.CSSProperties | undefined,
): React.CSSProperties | undefined {
    if (!style) {
        return style;
    }
    const rest: Record<string, unknown> = { ...style };
    for (const key of ENGINE_KEYS) {
        delete rest[key];
    }
    return rest as React.CSSProperties;
}

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
 * A tab's content panel (`role="tabpanel"`). Renders two portals:
 * - the panel element, into the panel layer of the tab's current layout; the engine positions it
 *   over the tabset's content area and shows or hides it (structural style only);
 * - the content (`children`), into the tab's moveable element, which the engine moves into
 *   whichever panel element is current.
 *
 * The content's position in the React tree never changes (it always lives under
 * `Dockable.Panels`), so moving a tab to another tabset or another window re-parents DOM without
 * remounting the content.
 */
export function Panel<T extends DockableTypes = AnyTypes>(
    props: PanelProps<T>,
) {
    const {
        node,
        children,
        style,
        scrollable = true,
        remountInWindow = false,
        ...rest
    } = props;
    const {
        engine: mainEngine,
        model,
        layers,
        keyMap,
    } = useDockableContext("Panel");
    const id = node.id;
    const layoutId = model.get("layout-id-by", { nodeId: id }) ?? MAIN_LAYOUT;
    const layer = layers.get(layoutId);
    const layoutEngine = layer?.engine ?? mainEngine;

    const [panelElement, setPanelElement] = React.useState<HTMLElement | null>(
        null,
    );
    const lastPanel = React.useRef<HTMLElement | null>(null);
    const latest = React.useRef({ id, remountInWindow });
    latest.current = { id, remountInWindow };

    const ref = React.useCallback(
        (element: HTMLElement | null) => {
            if (element) {
                lastPanel.current = element;
            }
            setPanelElement(element);
            layoutEngine.adapter.registerTabPanel(id, element);
        },
        [layoutEngine, id],
    );

    // move the content into the current panel element; with no panel element (the layout's layer
    // is not mounted yet) park it, so it stays in the document
    React.useLayoutEffect(() => {
        if (panelElement) {
            mainEngine.adapter.attachMoveable(id, panelElement, { scrollable });
        } else if (lastPanel.current) {
            mainEngine.adapter.releaseMoveable(id, lastPanel.current, {
                remountInWindow,
            });
        }
    }, [mainEngine, id, panelElement, scrollable, remountInWindow]);

    // on unmount only: park the content so its DOM survives
    React.useLayoutEffect(
        () => () => {
            mainEngine.adapter.releaseMoveable(
                latest.current.id,
                lastPanel.current ?? undefined,
                { remountInWindow: latest.current.remountInWindow },
            );
        },
        [mainEngine],
    );

    const selected = model.is("tab-selected", { tabId: id });
    // the engine's own rule, so the state always matches what it displays
    const visible = mainEngine.is("tab-panel-visible", { tabId: id });
    const state: PanelState = { selected, visible };

    const onPointerDown = () => {
        const tabset = model.get("node-parent-by", { nodeId: id });
        if (
            tabset?.type === "tabset" &&
            model.get("active-tabset", { layoutId })?.id !== tabset.id
        ) {
            model.run("tabset.activate", { tabsetId: tabset.id });
        }
    };

    // the configured key (pressed anywhere within the tab content) returns focus to the tab button
    const focusToggleKey = keyMap.focusTabToggle;
    const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
        if (!event.defaultPrevented && matchesKey(event, focusToggleKey)) {
            const button = event.currentTarget.ownerDocument.getElementById(
                mainEngine.get("tab-button-dom-id-by", { tabId: id }),
            );
            if (button) {
                button.focus();
                event.preventDefault();
                event.stopPropagation();
            }
        }
    };

    const consumerStyle =
        typeof style === "function"
            ? (s: PanelState) => withoutEngineKeys(style(s))
            : withoutEngineKeys(style);
    const panel = useRenderElement(
        "div",
        { ...rest, style: consumerStyle },
        {
            state,
            ref,
            props: {
                id: mainEngine.get("tab-panel-dom-id-by", { tabId: id }),
                role: "tabpanel",
                "aria-labelledby": mainEngine.get("tab-button-dom-id-by", {
                    tabId: id,
                }),
                "aria-keyshortcuts": toAriaKeyShortcuts(focusToggleKey),
                tabIndex: -1,
                ...dataAttributes({
                    "layout-path": mainEngine.adapter
                        .engineOf(id)
                        .get("layout-path-by", { nodeId: id }),
                    selected,
                    visible,
                }),
                onPointerDown,
                onKeyDown: focusToggleKey ? onKeyDown : undefined,
            },
            // absolute from first mount: the panel must never join the layout's flow before the
            // engine's positioning pass runs; the engine writes the geometry and display
            style: { position: "absolute" },
        },
    );

    const moveable = mainEngine.adapter.getMoveableElement(id);
    // with remountInWindow the content is keyed by its layout, so it remounts when it changes
    // window
    const windowKey = remountInWindow ? `:${layoutId}` : "";
    const contentKey = id + windowKey;

    // in a drag group, the content renders in the group's host, so it survives the tab moving to
    // another root; the panel hands over its context along with it. The host keys it by the
    // moveable element, which a transferred tab adopts: two models' tabs may share an id
    const dragGroup = React.useContext(DragGroupContext);
    const groupKey = keyOfMoveable(moveable) + windowKey;
    const dockable = React.useContext(DockableContext);
    const layout = React.useContext(LayoutContext);
    const modelContext = React.useContext(ModelContext);
    const owner = React.useRef({}).current;
    React.useLayoutEffect(() => {
        dragGroup?.registry.set(
            groupKey,
            owner,
            moveable,
            <ModelContext.Provider value={modelContext}>
                <DockableContext.Provider value={dockable}>
                    <LayoutContext.Provider value={layout}>
                        {children}
                    </LayoutContext.Provider>
                </DockableContext.Provider>
            </ModelContext.Provider>,
        );
    });
    React.useLayoutEffect(
        () => () => dragGroup?.registry.remove(groupKey, owner),
        [dragGroup, groupKey, owner],
    );

    return (
        <>
            {layer
                ? createPortal(panel, layer.element, `panel:${layoutId}`)
                : null}
            {dragGroup ? null : createPortal(children, moveable, contentKey)}
        </>
    );
}

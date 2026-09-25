import {
    Actions,
    getTabButtonId,
    getTabPanelId,
    getTabPanelPath,
    isTabPanelVisible,
    matchesKey,
    type TabNode,
    TabSetNode,
    toAriaKeyShortcuts,
} from "@fragiola/dockable";
import * as React from "react";
import { createPortal } from "react-dom";
import { useDockableContext } from "./context";
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

export interface PanelProps extends DivPrimitiveProps<PanelState> {
    node: TabNode;
    /** the tab's content */
    children?: React.ReactNode;
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
export function Panel(props: PanelProps) {
    const { node, children, style, ...rest } = props;
    const { engine: mainEngine, layers, keyMap } = useDockableContext("Panel");
    const layoutId = node.getLayoutId();
    const layer = layers.get(layoutId);
    const layoutEngine = layer?.engine ?? mainEngine;

    const [panelElement, setPanelElement] = React.useState<HTMLElement | null>(
        null,
    );
    const lastPanel = React.useRef<HTMLElement | null>(null);
    const latestNode = React.useRef(node);
    latestNode.current = node;

    const ref = React.useCallback(
        (element: HTMLElement | null) => {
            if (element) {
                lastPanel.current = element;
            }
            setPanelElement(element);
            layoutEngine.registerTabPanel(node, element);
        },
        [layoutEngine, node],
    );

    // move the content into the current panel element; with no panel element (the layout's layer
    // is not mounted yet) park it, so it stays in the document
    React.useLayoutEffect(() => {
        if (panelElement) {
            mainEngine.attachMoveable(node, panelElement);
        } else if (lastPanel.current) {
            mainEngine.releaseMoveable(node, lastPanel.current);
        }
    }, [mainEngine, node, panelElement]);

    // on unmount only: park the content so its DOM survives
    React.useLayoutEffect(
        () => () => {
            mainEngine.releaseMoveable(
                latestNode.current,
                lastPanel.current ?? undefined,
            );
        },
        [mainEngine],
    );

    const selected = node.isSelected();
    // the engine's own rule, so the state always matches what it displays
    const visible = isTabPanelVisible(node);
    const state: PanelState = { selected, visible };

    const onPointerDown = () => {
        const tabset = node.getParent();
        if (tabset instanceof TabSetNode && !tabset.isActive()) {
            layoutEngine.doAction(
                Actions.setActiveTabset(tabset.getId(), layoutId),
            );
        }
    };

    // the configured key (pressed anywhere within the tab content) returns focus to the tab button
    const focusToggleKey = keyMap.focusTabToggle;
    const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
        if (!event.defaultPrevented && matchesKey(event, focusToggleKey)) {
            const button = event.currentTarget.ownerDocument.getElementById(
                getTabButtonId(node),
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
                id: getTabPanelId(node),
                role: "tabpanel",
                "aria-labelledby": getTabButtonId(node),
                "aria-keyshortcuts": toAriaKeyShortcuts(focusToggleKey),
                tabIndex: -1,
                ...dataAttributes({
                    "layout-path": getTabPanelPath(node),
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

    const moveable = mainEngine.getMoveableElement(node);
    const windowId = node.getLayout().getWindowId() ?? "";
    const contentKey =
        node.getId() + (node.isEnableWindowReMount() ? windowId : "");

    return (
        <>
            {layer
                ? createPortal(panel, layer.element, `panel:${layoutId}`)
                : null}
            {createPortal(children, moveable, contentKey)}
        </>
    );
}

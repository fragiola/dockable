import {
    type BorderNode,
    createSplitterController,
    type DockableTypes,
    type RowNode,
    type SplitterAria,
} from "@fragiola/dockable";
import * as React from "react";
import type { SplitterState } from "../components/splitter";
import { useLayoutContext } from "../context";

export interface UseSplitterResult {
    /** what the splitter shows as `data-*` */
    state: SplitterState;
    /**
     * what goes on the splitter's element: the ref, `role="separator"` and its ARIA values, focus,
     * the pointer and key handlers, and the structural style (hidden, and the outline preview)
     */
    props: {
        ref: React.RefCallback<HTMLElement>;
        role: "separator";
        tabIndex: 0;
        "aria-orientation": SplitterAria["orientation"];
        "aria-valuenow": number | undefined;
        "aria-valuemin": number | undefined;
        "aria-valuemax": number | undefined;
        "aria-valuetext": string | undefined;
        onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
        onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
        style: React.CSSProperties;
    };
}

/**
 * The lower layer of `Dockable.Splitter`: the splitter before child `index` (1-based) of `node` (a
 * row, or a border with no index). Spread `props` on the separator element.
 */
export function useSplitter<T extends DockableTypes>(
    node: RowNode<T> | BorderNode<T>,
    index = 0,
): UseSplitterResult {
    const { engine } = useLayoutContext("useSplitter");
    const id = node.id;
    const controller = React.useMemo(
        () => createSplitterController(engine, id, index),
        [engine, id, index],
    );
    React.useEffect(() => () => controller.dispose(), [controller]);
    const state = React.useSyncExternalStore(
        controller.subscribe,
        controller.getState,
        controller.getState,
    );
    const ref = React.useCallback(
        (element: HTMLElement | null) => {
            controller.attach(element);
        },
        [controller],
    );
    // a snapshot: a measure after the commit that moved the splitter re-renders it before paint
    const aria = React.useSyncExternalStore(
        controller.subscribe,
        controller.getAria,
        controller.getAria,
    );
    const hidden = controller.isHidden();
    const style: React.CSSProperties = {};
    if (node.type === "border") {
        // an overlay border's content ignores presses (pointer-events: none), except its splitter
        style.pointerEvents = "auto";
    }
    if (hidden) {
        style.display = "none";
    }
    if (state.previewOffset !== undefined) {
        style.transform =
            aria.orientation === "vertical"
                ? `translateX(${state.previewOffset}px)`
                : `translateY(${state.previewOffset}px)`;
    }
    return {
        state: { ...state, orientation: aria.orientation, hidden },
        props: {
            ref,
            role: "separator",
            tabIndex: 0,
            "aria-orientation": aria.orientation,
            "aria-valuenow": aria.valueNow,
            "aria-valuemin": aria.valueMin,
            "aria-valuemax": aria.valueMax,
            "aria-valuetext": aria.valueText,
            onPointerDown: (event) =>
                controller.onPointerDown(event.nativeEvent),
            onKeyDown: (event) => {
                controller.onKeyDown(event.nativeEvent);
                if (event.nativeEvent.defaultPrevented) {
                    event.preventDefault();
                }
            },
            style,
        },
    };
}

import {
    type BorderNode,
    createSplitterController,
    type DockableTypes,
    type RowNode,
    type SplitterAria,
    type SplitterControllerState,
} from "@fragiola/dockable";
import {
    type ComputedRef,
    type CSSProperties,
    computed,
    type MaybeRefOrGetter,
    onScopeDispose,
    shallowRef,
    toValue,
    watch,
} from "vue";
import { useDockableContext, useLayoutContext } from "../context";
import { type ElementRef, elementRef } from "../utils/render";

export interface SplitterState extends SplitterControllerState {
    /** `"vertical"` for a splitter between side by side children, as its `aria-orientation` */
    orientation: "horizontal" | "vertical";
    /** row splitters are hidden while a tabset is maximized */
    hidden: boolean;
}

/** What goes on a splitter's element. */
export interface SplitterElementProps {
    ref: ElementRef;
    role: "separator";
    tabindex: 0;
    "aria-orientation": SplitterAria["orientation"];
    "aria-valuenow": number | undefined;
    "aria-valuemin": number | undefined;
    "aria-valuemax": number | undefined;
    "aria-valuetext": string | undefined;
    onPointerdown: (event: PointerEvent) => void;
    onKeydown: (event: KeyboardEvent) => void;
    style: CSSProperties;
}

export interface UseSplitterResult {
    /** what the splitter shows as `data-*` */
    state: ComputedRef<SplitterState>;
    /**
     * what goes on the splitter's element: the ref, `role="separator"` and its ARIA values, focus,
     * the pointer and key listeners, and the structural style (hidden, and the outline preview)
     */
    props: ComputedRef<SplitterElementProps>;
}

/**
 * The lower layer of `Dockable.Splitter`: the splitter before child `index` (1-based) of `node` (a
 * row, or a border with no index). Bind `props` on the separator element.
 */
export function useSplitter<T extends DockableTypes>(
    node: MaybeRefOrGetter<RowNode<T> | BorderNode<T>>,
    index: MaybeRefOrGetter<number | undefined> = 0,
): UseSplitterResult {
    const { revision } = useDockableContext("useSplitter");
    const { engine } = useLayoutContext("useSplitter");
    const key = () => [toValue(node).id, toValue(index) ?? 0] as const;
    const controller = shallowRef(createSplitterController(engine, ...key()));
    watch(
        () => key().join("\n"),
        () => {
            controller.value.dispose();
            controller.value = createSplitterController(engine, ...key());
        },
    );
    onScopeDispose(() => controller.value.dispose());
    const tick = shallowRef(0);
    watch(
        controller,
        (current, _previous, onCleanup) => {
            onCleanup(
                current.subscribe(() => {
                    tick.value++;
                }),
            );
        },
        { immediate: true, flush: "sync" },
    );
    const ref = elementRef(
        (element) => {
            const current = controller.value;
            current.attach(element);
            return () => current.attach(null);
        },
        () => [controller.value],
    );
    const state = computed<SplitterState>(() => {
        tick.value;
        revision.value;
        const current = controller.value;
        return {
            ...current.getState(),
            orientation: current.getAria().orientation,
            hidden: current.isHidden(),
        };
    });
    const props = computed<SplitterElementProps>(() => {
        tick.value;
        revision.value;
        const current = controller.value;
        const aria = current.getAria();
        const { previewOffset } = current.getState();
        const style: CSSProperties = {};
        if (toValue(node).type === "border") {
            // an overlay border's content ignores presses (pointer-events: none), except its splitter
            style.pointerEvents = "auto";
        }
        if (current.isHidden()) {
            style.display = "none";
        }
        if (previewOffset !== undefined) {
            style.transform =
                aria.orientation === "vertical"
                    ? `translateX(${previewOffset}px)`
                    : `translateY(${previewOffset}px)`;
        }
        return {
            ref,
            role: "separator",
            tabindex: 0,
            "aria-orientation": aria.orientation,
            "aria-valuenow": aria.valueNow,
            "aria-valuemin": aria.valueMin,
            "aria-valuemax": aria.valueMax,
            "aria-valuetext": aria.valueText,
            onPointerdown: (event: PointerEvent) =>
                controller.value.onPointerDown(event),
            onKeydown: (event: KeyboardEvent) =>
                controller.value.onKeyDown(event),
            style,
        };
    });
    return { state, props };
}

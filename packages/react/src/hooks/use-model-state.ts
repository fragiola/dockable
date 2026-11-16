import type {
    AnyTypes,
    DockableTypes,
    LayoutState,
    Model,
} from "@fragiola/dockable";
import * as React from "react";
import { ModelContext, typedModel } from "../context";

export interface UseModelStateOptions<
    T extends DockableTypes = AnyTypes,
    S = unknown,
> {
    /** the model to read; default: the enclosing `Dockable.Root`'s (then the hook needs one) */
    model?: Model<T> | undefined;
    /** whether two selections are the same, so the component does not re-render (`Object.is`) */
    isEqual?: ((a: S, b: S) => boolean) | undefined;
}

/**
 * A value selected from the model's state, re-rendering the component only when the selection
 * changes (`isEqual`, `Object.is` by default). The selector runs once per state; keep it pure.
 * Inside a `Dockable.Root` it reads the root's model; pass `model` to read one anywhere.
 *
 * ```ts
 * const count = useModelState<Types, number>((state, model) => model.get("all-tabs").length);
 * const open = useModelState((_state, model) => model.get("windows").length, { model });
 * ```
 */
export function useModelState<T extends DockableTypes = AnyTypes, S = unknown>(
    selector: (state: LayoutState<T>, model: Model<T>) => S,
    options: UseModelStateOptions<T, S> = {},
): S {
    const { isEqual = Object.is } = options;
    const context = React.useContext(ModelContext);
    const model =
        options.model ?? (context ? typedModel<T>(context) : undefined);
    if (!model) {
        throw new Error(
            "useModelState must be used inside Dockable.Root, or be given a model",
        );
    }
    const latest = React.useRef({ selector, isEqual });
    latest.current = { selector, isEqual };
    // the last selection, and what it was computed from: a new state, model or selector (a closure
    // over new props) selects again
    const cache = React.useRef<
        | {
              state: LayoutState<T>;
              value: S;
              model: Model<T>;
              selector: typeof selector;
          }
        | undefined
    >(undefined);
    const subscribe = React.useCallback(
        (onChange: () => void) => model.subscribe(() => onChange()),
        [model],
    );
    const getSnapshot = (): S => {
        const state = model.state;
        const current = latest.current.selector;
        const previous = cache.current;
        if (
            previous?.state === state &&
            previous.model === model &&
            previous.selector === current
        ) {
            return previous.value;
        }
        const value = current(state, model);
        const kept =
            previous !== undefined &&
            previous.model === model &&
            latest.current.isEqual(previous.value, value)
                ? previous.value
                : value;
        cache.current = { state, value: kept, model, selector: current };
        return kept;
    };
    return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

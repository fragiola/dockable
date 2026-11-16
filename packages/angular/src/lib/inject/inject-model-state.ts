import {
    computed,
    effect,
    inject,
    type Signal,
    signal,
    untracked,
} from "@angular/core";
import type {
    AnyTypes,
    DockableTypes,
    LayoutState,
    Model,
} from "@fragiola/dockable";
import { DOCKABLE, typedModel } from "../context";

export interface InjectModelStateOptions<
    T extends DockableTypes = AnyTypes,
    S = unknown,
> {
    /** the model to read (a model, or a signal of one); default: the enclosing `[dockableRoot]`'s */
    model?: Model<T> | Signal<Model<T> | undefined> | undefined;
    /** whether two selections are the same, so readers are not notified (`Object.is`) */
    isEqual?: ((a: S, b: S) => boolean) | undefined;
}

/**
 * A value selected from the model's state, as a signal that changes only when the selection
 * changes (`isEqual`, `Object.is` by default). The selector runs once per state; keep it pure.
 * Inside a `[dockableRoot]` it reads the root's model; pass `model` to read one anywhere.
 *
 * ```ts
 * readonly count = injectModelState<Types, number>((state, model) => model.get("all-tabs").length);
 * ```
 */
export function injectModelState<
    T extends DockableTypes = AnyTypes,
    S = unknown,
>(
    selector: (state: LayoutState<T>, model: Model<T>) => S,
    options: InjectModelStateOptions<T, S> = {},
): Signal<S> {
    const injected = inject(DOCKABLE, { optional: true });
    const given = options.model;
    const resolve = (): Model<T> => {
        const model =
            (typeof given === "function"
                ? (given as Signal<Model<T> | undefined>)()
                : given) ??
            (injected ? typedModel<T>(injected.model()) : undefined);
        if (!model) {
            throw new Error(
                "injectModelState must be used inside [dockableRoot], or be given a model",
            );
        }
        return model;
    };
    const tick = signal(0);
    effect((onCleanup) => {
        const model = resolve();
        onCleanup(
            model.subscribe(() => {
                tick.update((value) => value + 1);
            }),
        );
        untracked(() => tick.update((value) => value + 1));
    });
    return computed(
        () => {
            tick();
            const model = resolve();
            return selector(model.state, model);
        },
        { equal: options.isEqual ?? Object.is },
    );
}

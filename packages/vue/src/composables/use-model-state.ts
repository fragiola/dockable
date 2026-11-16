import type {
    AnyTypes,
    DockableTypes,
    LayoutState,
    Model,
} from "@fragiola/dockable";
import {
    inject,
    type MaybeRefOrGetter,
    type Ref,
    shallowRef,
    toValue,
    watch,
} from "vue";
import { ModelKey, typedModel } from "../context";

export interface UseModelStateOptions<
    T extends DockableTypes = AnyTypes,
    S = unknown,
> {
    /** the model to read; default: the enclosing `Dockable.Root`'s (then it needs one) */
    model?: MaybeRefOrGetter<Model<T> | undefined>;
    /** whether two selections are the same, so readers are not triggered (`Object.is`) */
    isEqual?: ((a: S, b: S) => boolean) | undefined;
}

/**
 * A value selected from the model's state, as a read-only ref that changes only when the
 * selection changes (`isEqual`, `Object.is` by default). The selector runs once per state; keep it
 * pure. Inside a `Dockable.Root` it reads the root's model; pass `model` to read one anywhere.
 *
 * ```ts
 * const count = useModelState<Types, number>((state, model) => model.get("all-tabs").length);
 * ```
 */
export function useModelState<T extends DockableTypes = AnyTypes, S = unknown>(
    selector: (state: LayoutState<T>, model: Model<T>) => S,
    options: UseModelStateOptions<T, S> = {},
): Readonly<Ref<S>> {
    const isEqual = options.isEqual ?? Object.is;
    const injected = inject(ModelKey, null);
    const resolve = (): Model<T> => {
        const model =
            toValue(options.model) ??
            (injected ? typedModel<T>(injected) : undefined);
        if (!model) {
            throw new Error(
                "useModelState must be used inside Dockable.Root, or be given a model",
            );
        }
        return model;
    };
    const first = resolve();
    const value = shallowRef<S>(selector(first.state, first));
    watch(
        resolve,
        (model, previous, onCleanup) => {
            const select = () => {
                const next = selector(model.state, model);
                if (!isEqual(value.value, next)) {
                    value.value = next;
                }
            };
            if (previous !== undefined) {
                // another model: its selection, whatever `isEqual` says
                value.value = selector(model.state, model);
            }
            onCleanup(model.subscribe(select));
        },
        { immediate: true, flush: "sync" },
    );
    return value;
}

import {
    type DefineSetupFnComponent,
    defineComponent,
    type SlotsType,
    type VNode,
    type VNodeChild,
} from "vue";
import type { AsProp } from "./render";

/** A slot function: what a scoped slot of a primitive receives, and the nodes it renders. */
export type SlotFunction<Scope> = (scope: Scope) => VNode[];

/** No events: every listener a primitive takes is a fallthrough attribute. */
type NoEmits = Record<never, never>;

/**
 * A primitive's public type: a component taking `Props` (plus any fallthrough attribute) with the
 * scoped slots `Slots`. Typed by the registry `T` through each part's props, and through
 * `typedDockable<T>()` for the parts that take no typed prop.
 */
export type DockableComponent<
    Props extends object,
    Slots extends object,
> = DefineSetupFnComponent<Props, NoEmits, SlotsType<Slots>>;

/** The props every primitive accepts on top of its own: `as` replaces its element. */
export interface PrimitiveProps {
    /** the tag or component rendered instead of the primitive's element (never `asChild`) */
    as?: AsProp | undefined;
}

/** What a primitive's setup receives with its props. */
export interface PrimitiveContext<Slots> {
    /** the fallthrough attributes: `class`, `style`, listeners, ARIA, `data-*`, … */
    attrs: Record<string, unknown>;
    slots: { readonly [K in keyof Slots]?: Slots[K] };
}

/**
 * Defines a primitive: a component with `inheritAttrs: false` (it merges the fallthrough attributes
 * itself, under its structural style) and the props named in `props`.
 */
export function definePrimitive<Props extends object, Slots extends object>(
    name: string,
    props: readonly (keyof Props & string)[],
    setup: (props: Props, context: PrimitiveContext<Slots>) => () => VNodeChild,
): DockableComponent<Props, Slots> {
    return defineComponent({
        name: `Dockable${name}`,
        inheritAttrs: false,
        props: [...props],
        setup(componentProps, { attrs, slots }) {
            return setup(componentProps as unknown as Props, {
                attrs,
                slots: slots as PrimitiveContext<Slots>["slots"],
            });
        },
    }) as unknown as DockableComponent<Props, Slots>;
}

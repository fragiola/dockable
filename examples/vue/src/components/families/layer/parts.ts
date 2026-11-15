// Vue port of the Fragiola UI layer parts (examples/react/src/components/families/layer/parts.tsx):
// the parts a dialog and an alert dialog share (backdrop, content, header, body, footer, title,
// description, close), made from Reka UI's dialog primitives with the `layer` family's classes.
//
// Base UI marks the open transition with `data-starting-style`/`data-ending-style`, which Reka UI
// does not set: the layer appears and leaves without the React kit's fade and scale.

import { XIcon } from "@lucide/vue";
import { type Component, defineComponent, h, type PropType } from "vue";
import { Clickable } from "#/components/atoms/clickable";
import { Text } from "#/components/atoms/text";
import { cn } from "#/lib/cn";
import { layer } from "../layer";

/** The Reka UI primitives a layer is made of. */
export type LayerPrimitives = {
    Overlay: Component;
    Content: Component;
    Title: Component;
    Description: Component;
    Close: Component;
};

function box(name: string, slot: string, classes: string) {
    return defineComponent({
        name,
        inheritAttrs: false,
        setup(_, { attrs, slots }) {
            return () =>
                h(
                    "div",
                    {
                        "data-slot": slot,
                        ...attrs,
                        class: cn(classes, attrs.class as string),
                    },
                    slots.default?.(),
                );
        },
    });
}

/** A primitive rendered as one of the text atoms (`as-child`), with the layer's classes. */
function text(
    name: string,
    primitive: Component,
    slot: string,
    atom: Component,
    atomProps: Record<string, unknown>,
    classes: string,
) {
    return defineComponent({
        name,
        inheritAttrs: false,
        setup(_, { attrs, slots }) {
            return () =>
                h(
                    primitive,
                    { asChild: true },
                    {
                        default: () =>
                            h(
                                atom,
                                {
                                    "data-slot": slot,
                                    ...atomProps,
                                    ...attrs,
                                    class: cn(classes, attrs.class as string),
                                },
                                slots,
                            ),
                    },
                );
        },
    });
}

export function createLayerParts(P: LayerPrimitives) {
    const Backdrop = defineComponent({
        name: "LayerBackdrop",
        inheritAttrs: false,
        setup(_, { attrs }) {
            return () =>
                h(P.Overlay, {
                    "data-slot": "layer-backdrop",
                    ...attrs,
                    class: cn(layer.backdrop(), attrs.class as string),
                });
        },
    });

    const Content = defineComponent({
        name: "LayerContent",
        inheritAttrs: false,
        props: {
            /** Whether to render the close affordance. alert-dialog sets this to false. */
            showClose: { type: Boolean as PropType<boolean>, default: true },
        },
        setup(props, { attrs, slots }) {
            return () =>
                h(
                    P.Content,
                    {
                        "data-slot": "layer-content",
                        ...attrs,
                        class: cn(
                            layer.panel(),
                            "duration-200 data-starting-style:scale-95 data-ending-style:scale-95",
                            attrs.class as string,
                        ),
                    },
                    {
                        default: () => [
                            props.showClose
                                ? h(
                                      P.Close,
                                      { asChild: true },
                                      {
                                          default: () =>
                                              h(
                                                  Clickable.Button,
                                                  {
                                                      variant: "icon",
                                                      shape: "square",
                                                      size: "sm",
                                                      "aria-label": "Close",
                                                      class: "absolute top-4 end-4",
                                                  },
                                                  { default: () => h(XIcon) },
                                              ),
                                      },
                                  )
                                : null,
                            slots.default?.(),
                        ],
                    },
                );
        },
    });

    const Close = defineComponent({
        name: "LayerClose",
        inheritAttrs: false,
        setup(_, { attrs, slots }) {
            return () =>
                h(
                    P.Close,
                    { asChild: true },
                    {
                        default: () =>
                            h(
                                Clickable.Button,
                                {
                                    "data-slot": "layer-close",
                                    variant: "ghost",
                                    size: "sm",
                                    ...attrs,
                                },
                                slots,
                            ),
                    },
                );
        },
    });

    return {
        Backdrop,
        Content,
        Header: box("LayerHeader", "layer-header", layer.header()),
        Body: box("LayerBody", "layer-body", layer.body()),
        Footer: box("LayerFooter", "layer-footer", layer.footer()),
        Title: text(
            "LayerTitle",
            P.Title,
            "layer-title",
            Text.Heading,
            { as: "h2" },
            layer.title(),
        ),
        Description: text(
            "LayerDescription",
            P.Description,
            "layer-description",
            Text.Paragraph,
            {},
            layer.description(),
        ),
        Close,
    };
}

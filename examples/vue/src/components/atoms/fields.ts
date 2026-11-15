// Vue port of the Fragiola UI input atom and its simple template
// (examples/react/src/components/atoms/fields): the same classes and palette roles (the `field`
// family) on a native `<input>`. `Input.Template.Simple` is a whole field: label, row, input,
// description and error, linked by id.

import { defineComponent, h, inject, type PropType } from "vue";
import { field } from "#/components/families/field";
import { FIELD_CONTROL_ID, Field } from "#/components/ui/field";
import { cn } from "#/lib/cn";

const InputControl = defineComponent({
    name: "FieldInput",
    inheritAttrs: false,
    setup(_, { attrs }) {
        const id = inject(FIELD_CONTROL_ID, undefined);
        return () =>
            h("input", {
                "data-slot": "input",
                id,
                ...attrs,
                class: cn(field.control(), attrs.class as string),
            });
    },
});

type Sides = { start?: string; end?: string };

const Simple = defineComponent({
    name: "InputTemplateSimple",
    inheritAttrs: false,
    props: {
        label: { type: String, default: undefined },
        description: { type: String, default: undefined },
        error: { type: String, default: undefined },
        required: { type: Boolean, default: false },
        inset: { type: Object as PropType<Sides>, default: undefined },
        addon: {
            type: Object as PropType<{ inline?: Sides; block?: Sides }>,
            default: undefined,
        },
    },
    setup(props, { attrs }) {
        return () => {
            const { class: className, ...inputProps } = attrs;
            return h(Field.Root, null, {
                default: () => [
                    props.label
                        ? h(Field.Label, null, {
                              default: () => [
                                  props.label,
                                  props.required
                                      ? h(
                                            "span",
                                            { "aria-hidden": "true" },
                                            "*",
                                        )
                                      : null,
                              ],
                          })
                        : null,
                    h(Field.Row, null, {
                        default: () => [
                            props.addon?.block?.start
                                ? h(
                                      Field.Addon,
                                      { side: "block-start" },
                                      () => props.addon?.block?.start,
                                  )
                                : null,
                            props.addon?.inline?.start
                                ? h(
                                      Field.Addon,
                                      { side: "inline-start" },
                                      () => props.addon?.inline?.start,
                                  )
                                : null,
                            h(
                                Field.Body,
                                { class: className as string },
                                {
                                    default: () => [
                                        props.inset?.start
                                            ? h(
                                                  "span",
                                                  { class: field.inset() },
                                                  props.inset.start,
                                              )
                                            : null,
                                        h(InputControl, {
                                            ...inputProps,
                                            required: props.required,
                                        }),
                                        props.inset?.end
                                            ? h(
                                                  "span",
                                                  { class: field.inset() },
                                                  props.inset.end,
                                              )
                                            : null,
                                    ],
                                },
                            ),
                            props.addon?.inline?.end
                                ? h(
                                      Field.Addon,
                                      { side: "inline-end" },
                                      () => props.addon?.inline?.end,
                                  )
                                : null,
                            props.addon?.block?.end
                                ? h(
                                      Field.Addon,
                                      { side: "block-end" },
                                      () => props.addon?.block?.end,
                                  )
                                : null,
                        ],
                    }),
                    props.description
                        ? h(Field.Description, null, () => props.description)
                        : null,
                    props.error
                        ? h(Field.Error, null, () => props.error)
                        : null,
                ],
            });
        };
    },
});

export const Input = Object.assign(InputControl, { Template: { Simple } });

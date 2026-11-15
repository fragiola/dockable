// Vue port of the Fragiola UI dropdown menu (examples/react/src/components/ui/dropdown-menu.tsx):
// the same parts, classes and palette roles, over Reka UI's DropdownMenu. The shared parts come
// from the menu family (`createMenuParts`); the trigger is Reka's (`as-child` puts its behaviour on
// your own element, where the React kit uses `render`). An item's action is `@select`.

import {
    DropdownMenuCheckboxItem,
    DropdownMenuContent as DropdownMenuContentPrimitive,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuItemIndicator,
    DropdownMenuLabel,
    DropdownMenuPortal,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuRoot as DropdownMenuRootPrimitive,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger as DropdownMenuTriggerPrimitive,
    injectDropdownMenuRootContext,
} from "reka-ui";
import { defineComponent, h, type PropType } from "vue";
import { createMenuParts } from "#/components/families/menu/parts";
import { cn } from "#/lib/cn";

const parts = createMenuParts(
    {
        Item: DropdownMenuItem,
        CheckboxItem: DropdownMenuCheckboxItem,
        ItemIndicator: DropdownMenuItemIndicator,
        RadioGroup: DropdownMenuRadioGroup,
        RadioItem: DropdownMenuRadioItem,
        Group: DropdownMenuGroup,
        Label: DropdownMenuLabel,
        Separator: DropdownMenuSeparator,
        Sub: DropdownMenuSub,
        SubTrigger: DropdownMenuSubTrigger,
        SubContent: DropdownMenuSubContent,
        Portal: DropdownMenuPortal,
        Content: DropdownMenuContentPrimitive,
    },
    () => injectDropdownMenuRootContext(),
);

const DropdownMenuRoot = defineComponent({
    name: "DropdownMenuRoot",
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
        return () =>
            h(
                DropdownMenuRootPrimitive,
                { "data-slot": "dropdown-menu", ...attrs },
                slots,
            );
    },
});

const DropdownMenuTrigger = defineComponent({
    name: "DropdownMenuTrigger",
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
        return () =>
            h(
                DropdownMenuTriggerPrimitive,
                { "data-slot": "dropdown-menu-trigger", ...attrs },
                slots,
            );
    },
});

const DropdownMenuContent = defineComponent({
    name: "DropdownMenuContent",
    inheritAttrs: false,
    props: {
        align: {
            type: String as PropType<"start" | "center" | "end">,
            default: "start",
        },
        alignOffset: { type: Number, default: 0 },
        side: {
            type: String as PropType<"top" | "right" | "bottom" | "left">,
            default: "bottom",
        },
        sideOffset: { type: Number, default: 4 },
    },
    setup(props, { attrs, slots }) {
        return () =>
            h(
                parts.Content,
                {
                    "data-slot": "dropdown-menu-content",
                    ...props,
                    ...attrs,
                    style: {
                        "--available-height":
                            "var(--reka-dropdown-menu-content-available-height)",
                        "--transform-origin":
                            "var(--reka-dropdown-menu-content-transform-origin)",
                    },
                    class: cn(
                        "max-h-(--available-height) origin-(--transform-origin) overflow-x-hidden overflow-y-auto outline-none data-closed:overflow-hidden",
                        attrs.class as string,
                    ),
                },
                slots,
            );
    },
});

export const DropdownMenu = {
    ...parts,
    Root: DropdownMenuRoot,
    Trigger: DropdownMenuTrigger,
    Content: DropdownMenuContent,
};

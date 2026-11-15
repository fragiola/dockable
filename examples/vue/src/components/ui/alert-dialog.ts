// Vue port of the Fragiola UI alert dialog (examples/react/src/components/ui/alert-dialog.tsx): the
// same parts, classes and palette roles (the `layer` family), over Reka UI's AlertDialog
// (`v-model:open` is Base UI's `open`/`onOpenChange`). The portal teleports to the body of the
// trigger's document when there is a trigger (popout windows), else to the page's.

import {
    AlertDialogCancel,
    AlertDialogContent as AlertDialogContentPrimitive,
    AlertDialogDescription,
    AlertDialogOverlay,
    AlertDialogPortal as AlertDialogPortalPrimitive,
    AlertDialogRoot as AlertDialogRootPrimitive,
    AlertDialogTitle,
    AlertDialogTrigger as AlertDialogTriggerPrimitive,
    injectDialogRootContext,
} from "reka-ui";
import { defineComponent, h } from "vue";
import { createLayerParts } from "#/components/families/layer/parts";
import { useOwnerBody } from "#/hooks/use-owner-body";
import { cn } from "#/lib/cn";

const parts = createLayerParts({
    Overlay: AlertDialogOverlay,
    Content: AlertDialogContentPrimitive,
    Title: AlertDialogTitle,
    Description: AlertDialogDescription,
    Close: AlertDialogCancel,
});

const AlertDialogRoot = defineComponent({
    name: "AlertDialogRoot",
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
        return () =>
            h(
                AlertDialogRootPrimitive,
                { "data-slot": "alert-dialog", ...attrs },
                slots,
            );
    },
});

const AlertDialogTrigger = defineComponent({
    name: "AlertDialogTrigger",
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
        return () =>
            h(
                AlertDialogTriggerPrimitive,
                { "data-slot": "alert-dialog-trigger", ...attrs },
                slots,
            );
    },
});

const AlertDialogPortal = defineComponent({
    name: "AlertDialogPortal",
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
        const root = injectDialogRootContext();
        const to = useOwnerBody(() => root.triggerElement.value, root.open);
        return () =>
            h(
                AlertDialogPortalPrimitive,
                { "data-slot": "alert-dialog-portal", to: to.value, ...attrs },
                slots,
            );
    },
});

const AlertDialogContent = defineComponent({
    name: "AlertDialogContent",
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
        const root = injectDialogRootContext();
        // the centring box covers the page: it exists only while the dialog is open
        return () =>
            root.open.value
                ? h(
                      "div",
                      {
                          class: "fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4",
                      },
                      [
                          h(
                              parts.Content,
                              {
                                  "data-slot": "alert-dialog-content",
                                  showClose: false,
                                  ...attrs,
                                  class: cn(
                                      "w-full max-w-lg",
                                      attrs.class as string,
                                  ),
                              },
                              slots,
                          ),
                      ],
                  )
                : null;
    },
});

export const AlertDialog = {
    Root: AlertDialogRoot,
    Trigger: AlertDialogTrigger,
    Portal: AlertDialogPortal,
    Backdrop: parts.Backdrop,
    Content: AlertDialogContent,
    Header: parts.Header,
    Body: parts.Body,
    Footer: parts.Footer,
    Title: parts.Title,
    Description: parts.Description,
    Close: parts.Close,
};

// Vue port of the Fragiola UI progress (examples/react/src/components/ui/progress.tsx): the same
// parts, classes and palette roles (the `track` family), over Reka UI's Progress (`model-value`
// is Base UI's `value`). Reka UI has no track part, so the track is a plain element, and its
// indicator has no geometry of its own: the indicator sets its width from the value, as Base UI's
// does.

import {
    injectProgressRootContext,
    ProgressIndicator as ProgressIndicatorPrimitive,
    ProgressRoot as ProgressRootPrimitive,
} from "reka-ui";
import { defineComponent, h } from "vue";
import { track } from "#/components/families/track";
import { cn } from "#/lib/cn";

const ProgressRoot = defineComponent({
    name: "ProgressRoot",
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
        return () =>
            h(
                ProgressRootPrimitive,
                {
                    "data-slot": "progress",
                    ...attrs,
                    class: cn(
                        "flex w-full flex-col gap-2",
                        attrs.class as string,
                    ),
                },
                slots,
            );
    },
});

const ProgressTrack = defineComponent({
    name: "ProgressTrack",
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
        return () =>
            h(
                "div",
                {
                    "data-slot": "progress-track",
                    ...attrs,
                    class: cn(
                        track.rail(),
                        "overflow-hidden",
                        attrs.class as string,
                    ),
                },
                slots.default?.(),
            );
    },
});

const ProgressIndicator = defineComponent({
    name: "ProgressIndicator",
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
        const root = injectProgressRootContext();
        return () => {
            const value = root.modelValue?.value;
            const indeterminate = value === null || value === undefined;
            return h(
                ProgressIndicatorPrimitive,
                {
                    "data-slot": "progress-indicator",
                    "data-indeterminate": indeterminate ? "" : undefined,
                    ...attrs,
                    style: indeterminate
                        ? undefined
                        : {
                              insetInlineStart: 0,
                              width: `${(value / root.max.value) * 100}%`,
                          },
                    class: cn(
                        track.fill(),
                        "inset-block-0",
                        "data-[indeterminate]:animate-progress-indeterminate data-[indeterminate]:w-1/3",
                        "motion-reduce:data-[indeterminate]:animate-none",
                        attrs.class as string,
                    ),
                },
                slots,
            );
        };
    },
});

export const Progress = {
    Root: ProgressRoot,
    Track: ProgressTrack,
    Indicator: ProgressIndicator,
};

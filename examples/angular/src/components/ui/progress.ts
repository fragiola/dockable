// Angular port of the Fragiola UI progress (examples/react/src/components/ui/progress.tsx): the same
// parts, classes and palette roles (the `track` family). Angular Aria and CDK have no progress bar:
// this is the WAI-ARIA progressbar pattern (`role="progressbar"`, `aria-valuenow`, none while the
// value is unknown) on native elements, and the indicator sets its width from the value as Base
// UI's does (`inset-inline-start: 0`, logical, so it fills from the end side in RTL).
//
//     <div kitProgress [value]="cpu" aria-label="CPU">
//         <div kitProgressTrack><div kitProgressIndicator></div></div>
//     </div>

import { computed, Directive, inject, input } from "@angular/core";
import { track } from "#/components/families/track";
import { cn } from "#/lib/cn";

@Directive({
    selector: "[kitProgress]",
    host: {
        role: "progressbar",
        "data-slot": "progress",
        "[attr.aria-valuemin]": "min()",
        "[attr.aria-valuemax]": "max()",
        "[attr.aria-valuenow]": "value() ?? null",
        "[attr.data-indeterminate]": "value() === null ? '' : null",
        "[attr.data-progressing]": "progressing() ? '' : null",
        "[attr.data-complete]": "complete() ? '' : null",
        "[class]": "classes()",
    },
})
export class Progress {
    /** The value, from `min` to `max`; `null` while it is unknown (indeterminate). */
    readonly value = input<number | null>(null);
    readonly min = input(0);
    readonly max = input(100);
    readonly class = input<string>();
    protected readonly complete = computed(() => this.value() === this.max());
    protected readonly progressing = computed(
        () => this.value() !== null && !this.complete(),
    );
    protected readonly classes = computed(() =>
        cn("flex w-full flex-col gap-2", this.class()),
    );
}

@Directive({
    selector: "[kitProgressTrack]",
    host: { "data-slot": "progress-track", "[class]": "classes()" },
})
export class ProgressTrack {
    readonly class = input<string>();
    protected readonly classes = computed(() =>
        cn(track.rail(), "overflow-hidden", this.class()),
    );
}

@Directive({
    selector: "[kitProgressIndicator]",
    host: {
        "data-slot": "progress-indicator",
        "[attr.data-indeterminate]": "percent() === null ? '' : null",
        "[style.inset-inline-start]": "percent() === null ? null : 0",
        "[style.width.%]": "percent()",
        "[class]": "classes()",
    },
})
export class ProgressIndicator {
    readonly class = input<string>();
    private readonly root = inject(Progress);
    protected readonly percent = computed(() => {
        const value = this.root.value();
        if (value === null) return null;
        const min = this.root.min();
        const span = this.root.max() - min;
        return span <= 0 ? 0 : ((value - min) / span) * 100;
    });
    protected readonly classes = computed(() =>
        cn(
            track.fill(),
            "inset-block-0",
            "data-[indeterminate]:animate-progress-indeterminate data-[indeterminate]:w-1/3",
            "motion-reduce:data-[indeterminate]:animate-none",
            this.class(),
        ),
    );
}

/** Every part of a progress bar, for a component's `imports`. */
export const PROGRESS = [Progress, ProgressTrack, ProgressIndicator] as const;

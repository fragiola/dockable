"use client";
// Vendored from the Fragiola UI registry (https://ui.fragiola.com/r/progress.json, source registry/ui/progress.tsx). Do not edit: re-run scripts/vendor-fragiola.ts.

import { Progress as ProgressPrimitive } from "@base-ui/react/progress";
import type * as React from "react";
import { Text } from "@/components/atoms/text";
import { field } from "@/components/families/field";
import { track } from "@/components/families/track";
import { cn } from "@/lib/cn";

// Progress — the rail without the interaction. The same `track` family as
// slider: `track.rail` for the rail, `track.fill` for the indicator. Tone
// arrives as a palette class from outside (`className="palette-orange"`), not
// as a prop — the same discipline as Clickable and Badge.
//
// Determinate and indeterminate. The primitive supplies the ARIA
// (`progressbar`, `aria-valuenow`, and the correct handling of "unknown" when
// value is `null`) — verify it does and do not hand-roll it.
//
// The indeterminate animation is a real animation and must respect
// `prefers-reduced-motion`. `motion-reduce:` is a Tailwind variant and, like
// everything else here, fails silently if misspelled — the guard test covers it.
//
// Fills from the inline start; inverts under RTL. The primitive sets
// `inset-inline-start: 0` and `width: <percent>%` inline (logical properties),
// so the inversion is automatic.

function ProgressRoot({
    className,
    ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
    return (
        <ProgressPrimitive.Root
            data-slot="progress"
            className={cn("flex w-full flex-col gap-2", className as string)}
            {...props}
        />
    );
}

function ProgressTrack({
    className,
    ...props
}: React.ComponentProps<typeof ProgressPrimitive.Track>) {
    return (
        <ProgressPrimitive.Track
            data-slot="progress-track"
            className={cn(track.rail(), "overflow-hidden", className as string)}
            {...props}
        />
    );
}

function ProgressIndicator({
    className,
    ...props
}: React.ComponentProps<typeof ProgressPrimitive.Indicator>) {
    // `inset-block-0` is pure layout (the fill spans the rail's height); the
    // slider's fill does not need it because the primitive anchors the vertical
    // indicator from `bottom`. Determinate: the primitive sets
    // `inset-inline-start: 0` + `width: <percent>%` inline. Indeterminate: the
    // primitive sets no geometry, so the indeterminate animation drives the
    // position via the keyframes below.
    return (
        <ProgressPrimitive.Indicator
            data-slot="progress-indicator"
            className={cn(
                track.fill(),
                "inset-block-0",
                "data-[indeterminate]:animate-progress-indeterminate data-[indeterminate]:w-1/3",
                "motion-reduce:data-[indeterminate]:animate-none",
                className as string,
            )}
            {...props}
        />
    );
}

function ProgressValue({
    className,
    ...props
}: React.ComponentProps<typeof ProgressPrimitive.Value>) {
    return (
        <ProgressPrimitive.Value
            data-slot="progress-value"
            className={cn(
                "text-sm text-palette-accent/85",
                className as string,
            )}
            {...props}
        />
    );
}

function ProgressLabel({
    className,
    ...props
}: React.ComponentProps<typeof ProgressPrimitive.Label>) {
    // field.label brings only palette/state; the typography (block/text-sm/
    // font-semibold) comes from Text.Label — the same composition rule as
    // Field.Label and Slider.Label.
    return (
        <ProgressPrimitive.Label
            data-slot="progress-label"
            render={<Text.Label />}
            className={cn(field.label(), className as string)}
            {...props}
        />
    );
}

export const Progress = {
    Root: ProgressRoot,
    Track: ProgressTrack,
    Indicator: ProgressIndicator,
    Value: ProgressValue,
    Label: ProgressLabel,
};

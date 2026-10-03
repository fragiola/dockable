import type { DropIndicatorState } from "@fragiola/dockable-react";
import { cn } from "#/lib/cn";

// How splitter-framed-handle looks: one class string per part, read by index.tsx.

/** The root needs a size; the gutter goes on this wrapper (padding on the root would not move
 * its row, which is `position: absolute; inset: 0`). */
export const frame = "flex min-h-0 flex-1 flex-col p-(--dk-gap)";

export const root =
    "palette-surface min-h-0 flex-1 bg-palette-base font-(family-name:--dk-font) text-palette-contrast";

/** Panels sit in a layer above the tabsets, whose overflow cannot clip them: the panel repeats
 * the tabset's inner radius on its corners. */
export const panel =
    "palette-raised overflow-auto rounded-b-[max(0px,calc(var(--dk-radius)-var(--dk-border)))] bg-palette-base bg-(image:--dk-panel-texture) text-palette-contrast";

/** Panels are portalled into the root after the indicator: `z-20` paints it above them. */
export const dropIndicator = (state: DropIndicatorState) =>
    cn(
        "z-20 rounded-(--dk-radius) border-2 [border-style:var(--dk-indicator-style)] border-palette-base transition-[left,top,width,height] duration-(--dk-motion)",
        state.kind === "edge"
            ? "palette-orange bg-palette-base/25"
            : "palette-blue bg-palette-base/20",
    );

export const tabset =
    "palette-raised rounded-(--dk-radius) border-(length:--dk-border) border-palette-line bg-palette-base text-palette-contrast shadow-(--dk-shadow) data-active:border-(--dk-tabset-active-line)";

export const strip =
    "flex min-h-(--dk-tab-height) items-stretch border-b border-palette-line";

export const tabList =
    "flex min-w-0 flex-1 items-end gap-(--dk-tab-gap) overflow-hidden bg-(--dk-strip-bg) ps-(--dk-strip-padding) pt-[calc(var(--dk-strip-padding)/2)]";

export const tab = cn(
    "relative flex h-(--dk-tab-height) max-w-60 shrink-0 cursor-pointer select-none items-center gap-1.5 px-3",
    "rounded-t-(--dk-tab-radius) font-(family-name:--dk-tab-font) text-(length:--dk-tab-size) text-palette-accent/85",
    "border-e-(length:--dk-tab-divider) border-palette-line outline-none transition-colors duration-(--dk-motion) hover:bg-palette-soft",
    "focus-visible:ring-2 focus-visible:ring-palette-ring focus-visible:ring-inset",
    "data-selected:bg-(--dk-tab-selected-bg) data-selected:text-(--dk-tab-selected-fg) data-dragging:opacity-40",
    // the active tabset's marker, drawn as the selected tab's ::after (`in-data-active:` reads
    // the enclosing TabSet's data-active); the theme sets its colour and display
    "after:pointer-events-none after:absolute after:inset-x-2 after:bottom-0 after:hidden after:h-0.5 after:rounded-full after:bg-(--dk-tab-marker-color) in-data-active:data-selected:after:[display:var(--dk-tab-marker)]",
);

export const tabName = "truncate";

/**
 * 8px thick (`w-2`/`h-2`): what the engine measures, and the grab area. What you see is its
 * `::before`, a 1px line along it, in the ring colour while dragged.
 */
export const splitter = cn(
    "group/splitter relative z-10 flex shrink-0 items-center justify-center outline-none",
    "before:absolute before:bg-palette-line before:transition-colors before:duration-(--dk-motion)",
    "data-dragging:before:bg-palette-ring",
    // side by side: a vertical bar
    "data-[orientation=vertical]:w-2 data-[orientation=vertical]:cursor-ew-resize",
    "data-[orientation=vertical]:before:inset-y-0 data-[orientation=vertical]:before:w-px",
    // stacked: a horizontal bar
    "data-[orientation=horizontal]:h-2 data-[orientation=horizontal]:cursor-ns-resize",
    "data-[orientation=horizontal]:before:inset-x-0 data-[orientation=horizontal]:before:h-px",
);

/**
 * The handle: a raised pill, wider than the bar it sits on (it overflows the splitter, which
 * paints above the panes: `z-10`). Its frame darkens on hover, takes the ring colour while
 * dragged, and shows a ring on keyboard focus.
 */
export const handle = cn(
    "palette-raised pointer-events-none relative flex items-center justify-center gap-0.5 rounded-full",
    "border border-palette-line bg-palette-base shadow-sm transition-colors duration-(--dk-motion)",
    "group-hover/splitter:border-palette-accent",
    "group-data-dragging/splitter:border-palette-ring group-data-dragging/splitter:bg-palette-soft",
    "group-focus-visible/splitter:ring-2 group-focus-visible/splitter:ring-palette-ring",
    "group-data-[orientation=vertical]/splitter:h-10 group-data-[orientation=vertical]/splitter:w-3.5 group-data-[orientation=vertical]/splitter:flex-row",
    "group-data-[orientation=horizontal]/splitter:h-3.5 group-data-[orientation=horizontal]/splitter:w-10 group-data-[orientation=horizontal]/splitter:flex-col",
);

/** The two grip lines on the pill, along the bar. */
export const handleLine = cn(
    "rounded-full bg-palette-accent/60",
    "group-data-[orientation=vertical]/splitter:h-4 group-data-[orientation=vertical]/splitter:w-px",
    "group-data-[orientation=horizontal]/splitter:h-px group-data-[orientation=horizontal]/splitter:w-4",
);

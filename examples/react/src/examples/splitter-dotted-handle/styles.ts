import type { DropIndicatorState } from "@fragiola/dockable-react";
import { cn } from "#/lib/cn";

// How splitter-dotted-handle looks: one class string per part, read by index.tsx.

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

/** 8px thick (`w-2`/`h-2`, the engine measures it): the whole bar is the grab area. */
export const splitter = cn(
    "group/splitter relative z-10 flex shrink-0 items-center justify-center rounded-full outline-none",
    "transition-colors duration-(--dk-motion) hover:bg-palette-soft",
    "focus-visible:ring-2 focus-visible:ring-palette-ring",
    "data-[orientation=vertical]:w-2 data-[orientation=vertical]:cursor-ew-resize",
    "data-[orientation=horizontal]:h-2 data-[orientation=horizontal]:cursor-ns-resize",
);

/** The dots line up along the bar: a column in a vertical splitter, a row in a horizontal one. */
export const grip = cn(
    "pointer-events-none flex gap-1",
    "group-data-[orientation=vertical]/splitter:flex-col group-data-[orientation=horizontal]/splitter:flex-row",
);

/** A dot: darker on hover, larger and in the ring colour while the splitter is dragged. */
export const dot = cn(
    "size-1 rounded-full bg-palette-line transition-[background-color,scale] duration-(--dk-motion)",
    "group-hover/splitter:bg-palette-accent",
    "group-data-dragging/splitter:scale-150 group-data-dragging/splitter:bg-palette-ring",
);

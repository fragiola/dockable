import type { DropIndicatorState } from "@fragiola/dockable-react";
import { cn } from "#/lib/cn";

// How tabs-at-bottom looks: one class string per part, read by index.tsx. Colours come from the
// palette roles and sizes from the theme's --dk-* tokens, so it works in every theme. The parts
// that meet the strip take `bottom`: whether the strip sits below the content.

/** The toolbar above the layout. */
export const page = "flex min-h-0 flex-1 flex-col";

export const toolbar =
    "palette-surface flex flex-wrap items-center gap-2 border-b border-palette-line bg-palette-base px-3 py-2 text-palette-contrast";

export const toolbarLabel = "text-sm text-palette-accent/85";

/** Top or Bottom; `aria-pressed` marks the chosen one. */
export const button = cn(
    "inline-flex h-8 items-center gap-1.5 rounded-md border border-palette-line bg-palette-base px-3 text-sm text-palette-contrast",
    "outline-none hover:bg-palette-soft focus-visible:ring-2 focus-visible:ring-palette-ring",
    "aria-pressed:bg-palette-soft aria-pressed:font-medium",
);

export const buttonIcon = "size-4";

/** The root needs a size; the gutter goes on this wrapper (padding on the root would not move
 * its row, which is `position: absolute; inset: 0`). */
export const frame = "flex min-h-0 flex-1 flex-col p-(--dk-gap)";

export const root =
    "palette-surface min-h-0 flex-1 bg-palette-base font-(family-name:--dk-font) text-palette-contrast";

/** Panels sit in a layer above the tabsets, whose overflow cannot clip them: the panel repeats
 * the tabset's inner radius on the corners away from the strip. */
export const panel = (bottom: boolean) =>
    cn(
        "palette-raised overflow-auto bg-palette-base bg-(image:--dk-panel-texture) text-palette-contrast",
        bottom
            ? "rounded-t-[max(0px,calc(var(--dk-radius)-var(--dk-border)))]"
            : "rounded-b-[max(0px,calc(var(--dk-radius)-var(--dk-border)))]",
    );

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

/** Below the content, the strip's rule moves to its top edge. */
export const strip = (bottom: boolean) =>
    cn(
        "flex min-h-(--dk-tab-height) items-stretch border-palette-line",
        bottom ? "border-t" : "border-b",
    );

export const tabList =
    "flex min-w-0 flex-1 items-end gap-(--dk-tab-gap) overflow-hidden bg-(--dk-strip-bg) ps-(--dk-strip-padding) pt-[calc(var(--dk-strip-padding)/2)]";

/** Below the content, the tabs hang from the strip's rule. */
export const tab = (bottom: boolean) =>
    cn(
        "relative flex h-(--dk-tab-height) max-w-60 shrink-0 cursor-pointer select-none items-center gap-1.5 px-3",
        "font-(family-name:--dk-tab-font) text-(length:--dk-tab-size) text-palette-accent/85",
        "border-e-(length:--dk-tab-divider) border-palette-line outline-none transition-colors duration-(--dk-motion) hover:bg-palette-soft",
        "focus-visible:ring-2 focus-visible:ring-palette-ring focus-visible:ring-inset",
        "data-selected:bg-(--dk-tab-selected-bg) data-selected:text-(--dk-tab-selected-fg) data-dragging:opacity-40",
        bottom ? "rounded-b-(--dk-tab-radius)" : "rounded-t-(--dk-tab-radius)",
        // the active tabset's marker, drawn as the selected tab's ::after (`in-data-active:` reads
        // the enclosing TabSet's data-active); the theme sets its colour and display
        "after:pointer-events-none after:absolute after:inset-x-2 after:hidden after:h-0.5 after:rounded-full after:bg-(--dk-tab-marker-color) in-data-active:data-selected:after:[display:var(--dk-tab-marker)]",
        bottom ? "after:top-0" : "after:bottom-0",
    );

export const tabName = "truncate";

/** `--dk-splitter-size` thick (the engine measures it), with a wider grab area (`::after`). */
export const splitter = cn(
    "group/splitter relative z-10 flex shrink-0 items-center justify-center bg-(--dk-splitter-bg) outline-none",
    "after:absolute after:transition-colors after:duration-(--dk-motion)",
    "hover:after:bg-palette-ring/30 data-dragging:after:bg-palette-ring/60 focus-visible:after:bg-palette-ring/60",
    // side by side: a vertical bar
    "data-[orientation=vertical]:w-(--dk-splitter-size) data-[orientation=vertical]:cursor-ew-resize",
    "data-[orientation=vertical]:after:inset-y-0 data-[orientation=vertical]:after:start-1/2",
    "data-[orientation=vertical]:after:w-(--dk-splitter-grab) data-[orientation=vertical]:after:-translate-x-1/2",
    "rtl:data-[orientation=vertical]:after:translate-x-1/2",
    // stacked: a horizontal bar
    "data-[orientation=horizontal]:h-(--dk-splitter-size) data-[orientation=horizontal]:cursor-ns-resize",
    "data-[orientation=horizontal]:after:inset-x-0 data-[orientation=horizontal]:after:top-1/2",
    "data-[orientation=horizontal]:after:h-(--dk-splitter-grab) data-[orientation=horizontal]:after:-translate-y-1/2",
);

/** The grip, for the themes that show one (`--dk-grip`). */
export const splitterGrip = cn(
    "pointer-events-none [display:var(--dk-grip)] rounded-full bg-palette-line",
    "group-data-[orientation=vertical]/splitter:h-8 group-data-[orientation=vertical]/splitter:w-1",
    "group-data-[orientation=horizontal]/splitter:h-1 group-data-[orientation=horizontal]/splitter:w-8",
);

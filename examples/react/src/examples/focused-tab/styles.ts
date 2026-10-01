import type { DropIndicatorState } from "@fragiola/dockable-react";
import { cn } from "#/lib/cn";

// How focused-tab looks: one class string per part, read by index.tsx. The focused tab (the
// selected tab of the active tabset) is the one that stands out.

/** The root needs a size; the gutter goes on this wrapper. */
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
        "z-20 rounded-(--dk-radius) border-2 [border-style:var(--dk-indicator-style)] border-palette-base transition-[left,top,width,height]",
        state.kind === "edge"
            ? "palette-orange bg-palette-base/25"
            : "palette-blue bg-palette-base/20",
    );

/** The active tabset's frame takes the ring colour. */
export const tabset =
    "palette-raised rounded-(--dk-radius) border-(length:--dk-border) border-palette-line bg-palette-base text-palette-contrast shadow-(--dk-shadow) transition-colors duration-(--dk-motion) data-active:border-palette-ring";

export const strip =
    "flex min-h-(--dk-tab-height) items-stretch border-b border-palette-line";

/** The start padding is load-bearing: a tab flush with the tabset's edge could not take a drop
 * before it (that edge is the tabset's side drop). */
export const tabList =
    "flex min-w-0 flex-1 items-end gap-(--dk-tab-gap) overflow-hidden bg-(--dk-strip-bg) ps-[max(0.25rem,var(--dk-strip-padding))] pt-[calc(var(--dk-strip-padding)/2)]";

/** A tab does not know whether its tabset is active: `in-data-active:` reads the enclosing
 * TabSet's data-active (`:where([data-active]) &`), so the focused tab is
 * `in-data-active:data-selected:`. */
export const tab = cn(
    "group/tab relative flex h-(--dk-tab-height) max-w-60 shrink-0 cursor-pointer select-none items-center gap-1.5 px-3",
    "rounded-t-(--dk-tab-radius) font-(family-name:--dk-tab-font) text-(length:--dk-tab-size) text-palette-accent/85",
    "border-e-(length:--dk-tab-divider) border-palette-line outline-none hover:bg-palette-soft",
    "data-selected:bg-(--dk-tab-selected-bg) data-selected:text-(--dk-tab-selected-fg) data-dragging:opacity-40",
    // every other tab (the rest of the active tabset, and all tabs of the other tabsets): faded
    "opacity-50 transition-opacity duration-(--dk-motion)",
    // the focused tab: full opacity, bold, and a 2px frame in the ring colour (outline-solid: the
    // tab is outline-none otherwise)
    "in-data-active:data-selected:opacity-100 in-data-active:data-selected:font-semibold in-data-active:data-selected:text-palette-contrast",
    "in-data-active:data-selected:outline-2 in-data-active:data-selected:outline-solid in-data-active:data-selected:-outline-offset-2 in-data-active:data-selected:outline-palette-ring",
    // keyboard focus: a dashed frame (no ring), so it never reads as "the focused tab"
    "focus-visible:opacity-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-dashed focus-visible:outline-palette-contrast",
);

export const tabName = "truncate";

/** The active tabset's marker: `in-data-active:` reads the enclosing TabSet's data-active,
 * `group-data-selected/tab:` this tab's. */
export const tabMarker =
    "palette-blue pointer-events-none absolute inset-x-2 bottom-0 hidden h-0.5 rounded-full bg-palette-base in-data-active:group-data-selected/tab:[display:var(--dk-tab-marker)]";

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

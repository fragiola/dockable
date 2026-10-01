import type { DropIndicatorState } from "@fragiola/dockable-react";
import { cn } from "#/lib/cn";

// How splitter-hairline looks: one class string per part, read by index.tsx. The splitter is a
// 1px line with a wider grab area.

/** The root needs a size; the gutter goes on this wrapper. */
export const frame = "flex min-h-0 flex-1 flex-col p-(--dk-gap)";

/** Flush panes read best against a hairline: this example drops the theme's corners, borders
 * and shadow (its colours still come from the theme). */
export const root =
    "palette-surface min-h-0 flex-1 bg-palette-base font-(family-name:--dk-font) text-palette-contrast [--dk-border:0px] [--dk-radius:0px] [--dk-shadow:none]";

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

export const tabset =
    "palette-raised rounded-(--dk-radius) border-(length:--dk-border) border-palette-line bg-palette-base text-palette-contrast shadow-(--dk-shadow) data-active:border-(--dk-tabset-active-line)";

export const strip =
    "flex min-h-(--dk-tab-height) items-stretch border-b border-palette-line";

/** The start padding is load-bearing: a tab flush with the tabset's edge could not take a drop
 * before it (that edge is the tabset's side drop). */
export const tabList =
    "flex min-w-0 flex-1 items-end gap-(--dk-tab-gap) overflow-hidden bg-(--dk-strip-bg) ps-[max(0.25rem,var(--dk-strip-padding))] pt-[calc(var(--dk-strip-padding)/2)]";

export const tab = cn(
    "group/tab relative flex h-(--dk-tab-height) max-w-60 shrink-0 cursor-pointer select-none items-center gap-1.5 px-3",
    "rounded-t-(--dk-tab-radius) font-(family-name:--dk-tab-font) text-(length:--dk-tab-size) text-palette-accent/85",
    "border-e-(length:--dk-tab-divider) border-palette-line outline-none transition-colors duration-(--dk-motion) hover:bg-palette-soft",
    "focus-visible:ring-2 focus-visible:ring-palette-ring focus-visible:ring-inset",
    "data-selected:bg-(--dk-tab-selected-bg) data-selected:text-(--dk-tab-selected-fg) data-dragging:opacity-40",
);

export const tabName = "truncate";

/** The active tabset's marker: `in-data-active:` reads the enclosing TabSet's data-active,
 * `group-data-selected/tab:` this tab's. */
export const tabMarker =
    "palette-blue pointer-events-none absolute inset-x-2 bottom-0 hidden h-0.5 rounded-full bg-palette-base in-data-active:group-data-selected/tab:[display:var(--dk-tab-marker)]";

/** The element itself is 1px: that is what the engine measures for the split maths. The grab
 * area is its `::after`, 7px wide and centred on the line, so the pointer catches it 3px either
 * side. The band fills only while `data-dragging` or on keyboard focus, never on hover.
 * `relative z-10` keeps the grab area above the tabsets and panels it overlaps. */
export const splitter = cn(
    "relative z-10 shrink-0 bg-palette-line outline-none",
    "after:absolute after:transition-colors after:duration-(--dk-motion)",
    "data-dragging:after:bg-palette-ring focus-visible:after:bg-palette-ring",
    // a vertical bar between side-by-side panes
    "data-[orientation=vertical]:w-px data-[orientation=vertical]:cursor-ew-resize",
    "data-[orientation=vertical]:after:inset-y-0 data-[orientation=vertical]:after:start-1/2",
    "data-[orientation=vertical]:after:w-[7px] data-[orientation=vertical]:after:-translate-x-1/2",
    "rtl:data-[orientation=vertical]:after:translate-x-1/2",
    // a horizontal bar between stacked panes
    "data-[orientation=horizontal]:h-px data-[orientation=horizontal]:cursor-ns-resize",
    "data-[orientation=horizontal]:after:inset-x-0 data-[orientation=horizontal]:after:top-1/2",
    "data-[orientation=horizontal]:after:h-[7px] data-[orientation=horizontal]:after:-translate-y-1/2",
);

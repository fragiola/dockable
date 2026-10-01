import type { DropIndicatorState } from "@fragiola/dockable-react";
import { cn } from "#/lib/cn";

// How splitter-wide looks: one class string per part, read by index.tsx.

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

// ─── the wide splitter ───

/** 12px thick (`w-3`/`h-3`, the engine measures it); `vertical` is a bar between side-by-side
 * panes. */
export const splitter = (vertical: boolean) =>
    cn(
        "group/splitter relative z-10 flex shrink-0 items-center justify-center rounded-full outline-none",
        "transition-colors duration-(--dk-motion) hover:bg-palette-soft",
        "data-dragging:bg-palette-soft focus-visible:ring-2 focus-visible:ring-palette-ring",
        vertical
            ? "w-3 cursor-ew-resize flex-col"
            : "h-3 cursor-ns-resize flex-row",
    );

/** One of the grip's three dots. */
export const splitterDot = cn(
    "m-0.5 size-1 rounded-full bg-palette-line transition-colors",
    "group-hover/splitter:bg-palette-accent group-data-dragging/splitter:bg-palette-ring",
);

/** The bubble with `aria-valuetext`, shown while the splitter is dragged or focused. */
export const splitterReadout = (vertical: boolean) =>
    cn(
        "palette-blue pointer-events-none absolute hidden rounded-md bg-palette-base px-1.5 py-0.5",
        "text-xs font-medium tabular-nums text-palette-contrast shadow-sm",
        "group-focus-visible/splitter:block group-data-dragging/splitter:block",
        // just past the grip, centred on the bar
        vertical
            ? "start-1/2 top-[calc(50%+1.5rem)] -translate-x-1/2 rtl:translate-x-1/2"
            : "start-[calc(50%+1.5rem)] top-1/2 -translate-y-1/2",
    );

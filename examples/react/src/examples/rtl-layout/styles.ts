import type { DropIndicatorState } from "@fragiola/dockable-react";
import { cn } from "#/lib/cn";

// How rtl-layout looks: one class string per part, read by index.tsx. Every side is logical
// (`ps-`, `border-e`, `start-`), so the same classes mirror with the page; only the edge arrows
// need an `rtl:` variant, an icon having no logical form.

export const page = "flex min-h-0 flex-1 flex-col";

// ─── toolbar ───

export const toolbar =
    "palette-surface flex flex-wrap items-center gap-2 border-b border-palette-line bg-palette-base px-3 py-2 text-palette-contrast";

export const hint = "text-sm text-palette-accent/85";

export const button =
    "inline-flex h-8 items-center gap-1.5 rounded-md border border-palette-line bg-palette-base px-3 text-sm text-palette-contrast outline-none hover:bg-palette-soft focus-visible:ring-2 focus-visible:ring-palette-ring aria-pressed:bg-palette-soft";

// ─── layout ───

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

/** The band along a layout edge, solid while the drop would go there (`data-drop-target`). */
export const edgeIndicator = cn(
    "palette-orange z-20 flex items-center justify-center rounded-sm bg-palette-base/40 text-palette-contrast",
    "transition-colors duration-(--dk-motion) data-drop-target:bg-palette-base",
);

/** The start arrow points left, the end one right: in RTL, both turn round. */
export const edgeArrow = "size-3 rtl:-scale-x-100";

// ─── tabs ───

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
);

export const tabName = "truncate";

// ─── borders ───

/** A border's strip, with a line on the layout's side: `border-e` on the start border is the
 * side facing the layout in both directions. */
export const border = cn(
    "palette-surface shrink-0 bg-palette-base text-palette-contrast",
    "data-[orientation=vertical]:w-(--dk-tab-height) data-[orientation=horizontal]:h-(--dk-tab-height)",
    "data-[location=start]:border-e data-[location=end]:border-s data-[location=top]:border-b data-[location=bottom]:border-t border-palette-line",
    "data-drop-target:bg-palette-soft",
);

export const borderTabList =
    "flex min-h-0 min-w-0 flex-1 gap-(--dk-tab-gap) p-1 data-[orientation=vertical]:flex-col";

export const borderTab = cn(
    "flex shrink-0 cursor-pointer select-none items-center gap-1.5 rounded-sm px-2 py-1",
    "font-(family-name:--dk-tab-font) text-(length:--dk-tab-size) text-palette-accent/85",
    "outline-none hover:bg-palette-soft focus-visible:ring-2 focus-visible:ring-palette-ring focus-visible:ring-inset",
    "data-selected:bg-palette-soft data-selected:text-palette-contrast data-dragging:opacity-40",
    // a side border's labels turn with `writing-mode` (reading down); a start border that reads
    // "up" (`data-tab-direction`, on the left) turns them half a turn more
    "in-data-[orientation=vertical]:[writing-mode:vertical-rl] in-data-[orientation=vertical]:px-1 in-data-[orientation=vertical]:py-2",
    "in-data-[tab-direction=up]:rotate-180",
);

/** An overlay paints over the layout: a stacking order, a shadow and a line facing the layout. */
export const borderContent = cn(
    "data-overlay:z-30 data-overlay:shadow-xl data-overlay:border-palette-line",
    "data-overlay:data-[location=start]:border-e data-overlay:data-[location=end]:border-s",
    "data-overlay:data-[location=top]:border-b data-overlay:data-[location=bottom]:border-t",
);

// ─── splitter ───

/** `--dk-splitter-size` thick (the engine measures it), with a wider grab area (`::after`). */
export const splitter = cn(
    "group/splitter relative z-10 flex shrink-0 items-center justify-center bg-(--dk-splitter-bg) outline-none",
    "in-data-overlay:bg-palette-base in-data-overlay:bg-[image:linear-gradient(var(--dk-splitter-bg),var(--dk-splitter-bg))]",
    "after:absolute after:transition-colors after:duration-(--dk-motion)",
    "hover:after:bg-palette-ring/30 data-dragging:after:bg-palette-ring/60 focus-visible:after:bg-palette-ring/60",
    // side by side: a vertical bar, its grab area centred from the start side
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

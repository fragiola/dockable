import type { DropIndicatorState } from "@fragiola/dockable-react";
import { cn } from "#/lib/cn";

// How border-tab-orientation looks: one class string per part, read by index.tsx. The toggle only
// switches `border` and `borderTab` between their two sets of classes.

export const page = "flex min-h-0 flex-1 flex-col";

// ─── toolbar ───

export const toolbar =
    "palette-surface flex flex-wrap items-center gap-2 border-b border-palette-line bg-palette-base px-3 py-2 text-palette-contrast";

export const toggleGroup = "flex items-center gap-1";

export const legend = "sr-only";

export const toggle = cn(
    "inline-flex h-8 items-center gap-1.5 rounded-md border border-palette-line bg-palette-base px-3 text-sm text-palette-contrast",
    "outline-none hover:bg-palette-soft focus-visible:ring-2 focus-visible:ring-palette-ring",
    "aria-pressed:bg-palette-soft",
);

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

/** The demo content: the side panels' lists and text, and the document's chart (a fixed height
 * inside the scrolling document). */
export const list = "flex flex-col gap-1.5 text-sm text-palette-accent/85";

export const query = "text-sm font-medium";

export const text = "max-w-prose text-sm leading-6 text-palette-accent/85";

export const documentChart = "h-64 px-0";

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

// ─── borders ───

/** A border's strip: `--dk-tab-height` thick, on the floor's colour, with a line on the layout's
 * side. `data-orientation` is the direction its tabs run, `data-location` the side it is on. */
export const border = (upright: boolean) =>
    cn(
        "palette-surface shrink-0 bg-palette-base text-palette-contrast",
        // upright labels: a side strip grows to fit them
        upright
            ? "data-[orientation=vertical]:w-auto"
            : "data-[orientation=vertical]:w-(--dk-tab-height)",
        "data-[orientation=horizontal]:h-(--dk-tab-height)",
        "data-[location=start]:border-e data-[location=end]:border-s data-[location=top]:border-b data-[location=bottom]:border-t border-palette-line",
        "data-drop-target:bg-palette-soft",
    );

/** A column in a side border. */
export const borderTabList =
    "flex min-h-0 min-w-0 flex-1 gap-(--dk-tab-gap) p-1 data-[orientation=vertical]:flex-col";

/** Upright labels are as wide as the strip; vertical labels are turned with `writing-mode`, and a
 * start border that reads "up" (`data-tab-direction`) turns them half a turn more, so the tabs stay
 * in order from the top. */
export const borderTab = (upright: boolean) =>
    cn(
        "flex shrink-0 cursor-pointer select-none items-center gap-1.5 rounded-sm px-2 py-1",
        "font-(family-name:--dk-tab-font) text-(length:--dk-tab-size) text-palette-accent/85",
        "outline-none hover:bg-palette-soft focus-visible:ring-2 focus-visible:ring-palette-ring focus-visible:ring-inset",
        "data-selected:bg-palette-soft data-selected:text-palette-contrast data-dragging:opacity-40",
        upright
            ? "w-full"
            : [
                  "in-data-[orientation=vertical]:[writing-mode:vertical-rl] in-data-[orientation=vertical]:px-1 in-data-[orientation=vertical]:py-2",
                  "in-data-[tab-direction=up]:rotate-180",
              ],
    );

export const labelIcon = "size-3.5 shrink-0";

// ─── splitters ───

/** Between two children of a row, or beside a border's panel: `--dk-splitter-size` thick (the
 * engine measures it), with a wider grab area (`::after`). */
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

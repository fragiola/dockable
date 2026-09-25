import type { DropIndicatorState } from "@fragiola/dockable-react";

/**
 * The example kit's class names: Tailwind utilities over the Fragiola palette roles
 * (`bg-palette-base`, `text-palette-contrast`, …), the package's `data-*` state
 * (`data-selected:`, `data-dragging:`, `in-data-active:`, …) and the theme's shape tokens
 * (`--dk-radius`, `--dk-splitter-size`, … declared by each `_themes/<name>.css`).
 *
 * Nothing here is required by the package: it paints nothing. Copy this file, or replace any
 * string with your own.
 */

/** The element around `Dockable.Root`: the outer gutter. The root row is `position: absolute;
 * inset: 0`, so padding on the root itself would not move it; the gutter goes on a wrapper. */
export const frame = "flex min-h-0 flex-1 flex-col p-(--dk-gap)";

/** `Dockable.Root`: the floor the tabsets sit on. It needs a size: an unsized root shows nothing. */
export const root =
    "palette-surface min-h-0 flex-1 bg-palette-base text-palette-contrast font-(family-name:--dk-font)";

/** `Dockable.TabSet`: a card on the floor. */
export const tabset = [
    "palette-raised bg-palette-base text-palette-contrast",
    "rounded-(--dk-radius) border-(length:--dk-border) border-palette-line shadow-(--dk-shadow)",
].join(" ");

/** The strip row: the tab list plus the tabset's own buttons. */
export const tabsetHeader =
    "flex min-h-(--dk-tab-height) items-stretch border-b border-palette-line";

/**
 * `Dockable.TabList`. The start padding is load-bearing: a tab flush with the tabset's edge
 * cannot take a drop before it (the edge belongs to the tabset's side drop; gap 10 in the
 * walking-skeleton report), so the list always keeps a few pixels (`ps-1` minimum).
 */
export const tabList =
    "flex min-w-0 flex-1 items-end gap-(--dk-tab-gap) overflow-hidden ps-[max(0.25rem,var(--dk-strip-padding))] pt-[calc(var(--dk-strip-padding)/2)]";

/**
 * `Dockable.Tab`. The selected tab takes the `soft` role; the dragged one fades.
 * `in-data-active:` reads the enclosing `TabSet`'s `data-active` (the kit's workaround for the
 * missing `data-tabset-active` on `Tab`, gap 1).
 */
export const tab = [
    "group/tab relative flex h-(--dk-tab-height) max-w-60 shrink-0 cursor-pointer select-none items-center gap-1.5 px-3",
    "rounded-t-(--dk-tab-radius) font-(family-name:--dk-tab-font) text-(length:--dk-tab-size) text-palette-accent/85",
    "outline-none transition-colors duration-(--dk-motion) hover:bg-palette-soft",
    "focus-visible:ring-2 focus-visible:ring-palette-ring focus-visible:ring-inset",
    "data-selected:bg-palette-soft data-selected:text-palette-contrast data-dragging:opacity-40",
].join(" ");

/** The tab's label: truncates, so a long name never breaks the strip. */
export const tabLabel = "truncate";

/** The active-tabset marker inside the selected tab: shown only when its tabset is active. */
export const tabMarker =
    "palette-blue pointer-events-none absolute inset-x-2 bottom-0 hidden h-0.5 rounded-full bg-palette-base in-data-active:group-data-selected/tab:block";

/** A small icon button inside a tab or a tabset header (close, pop out, maximize, …). */
export const iconButton = [
    "grid size-6 shrink-0 place-items-center self-center rounded-sm text-palette-accent/85",
    "outline-none hover:bg-palette-soft hover:text-palette-contrast",
    "focus-visible:ring-2 focus-visible:ring-palette-ring",
    "disabled:pointer-events-none disabled:opacity-40",
].join(" ");

/** The buttons at the end of a tabset header. */
export const tabsetActions = "flex items-center gap-0.5 pe-1";

/** `Dockable.Panel`: repeats the tabset's inner radius on its bottom corners, since panels live in
 * a layer above the tabsets and their `overflow` cannot clip them (gap 2). */
export const panel =
    "palette-raised overflow-auto rounded-b-[max(0px,calc(var(--dk-radius)-var(--dk-border)))] bg-palette-base text-palette-contrast";

/**
 * `Dockable.Splitter`: the visible part is `--dk-splitter-size` thick, the grab area (`::after`,
 * centred on it) is `--dk-splitter-grab`. The engine measures the element for the split maths and
 * ignores the pseudo-element. `relative z-10` keeps the grab area above the tabsets it overlaps.
 */
export const splitter = [
    "group/splitter relative z-10 flex shrink-0 items-center justify-center bg-(--dk-splitter-bg) outline-none",
    "after:absolute after:transition-colors after:duration-(--dk-motion)",
    "hover:after:bg-palette-ring/30 data-dragging:after:bg-palette-ring/60 focus-visible:after:bg-palette-ring/60",
    // side-by-side children: a vertical bar
    "data-[orientation=vertical]:w-(--dk-splitter-size) data-[orientation=vertical]:cursor-ew-resize",
    "data-[orientation=vertical]:after:inset-y-0 data-[orientation=vertical]:after:start-1/2",
    "data-[orientation=vertical]:after:w-(--dk-splitter-grab) data-[orientation=vertical]:after:-translate-x-1/2",
    "rtl:data-[orientation=vertical]:after:translate-x-1/2",
    // stacked children: a horizontal bar
    "data-[orientation=horizontal]:h-(--dk-splitter-size) data-[orientation=horizontal]:cursor-ns-resize",
    "data-[orientation=horizontal]:after:inset-x-0 data-[orientation=horizontal]:after:top-1/2",
    "data-[orientation=horizontal]:after:h-(--dk-splitter-grab) data-[orientation=horizontal]:after:-translate-y-1/2",
].join(" ");

/** The grip drawn in the middle of a splitter, for themes that set `--dk-grip: block`. */
export const splitterGrip = [
    "pointer-events-none [display:var(--dk-grip)] rounded-full bg-palette-line",
    // group-data (the splitter itself), not in-data: an enclosing Row has data-orientation too
    "group-data-[orientation=vertical]/splitter:h-8 group-data-[orientation=vertical]/splitter:w-1",
    "group-data-[orientation=horizontal]/splitter:h-1 group-data-[orientation=horizontal]/splitter:w-8",
].join(" ");

/**
 * `Dockable.DropIndicator`: blue for a drop into a tabset, orange (and the theme's
 * `--dk-indicator-style`) for a drop at a row's edge. `z-10`: panels are portalled into the root
 * after the indicator, so without a stacking order they would paint over it (gap 12).
 */
export function dropIndicator(state: DropIndicatorState): string {
    const shared =
        "z-20 rounded-(--dk-radius) border-2 [border-style:var(--dk-indicator-style)] border-palette-base transition-[left,top,width,height]";
    return state.kind === "edge"
        ? `palette-orange bg-palette-base/25 ${shared}`
        : `palette-blue bg-palette-base/20 ${shared}`;
}

/** A regular button in an example's toolbar. */
export const button = [
    "inline-flex h-8 items-center gap-1.5 rounded-md border border-palette-line bg-palette-base px-3 text-sm",
    "text-palette-contrast outline-none hover:bg-palette-soft focus-visible:ring-2 focus-visible:ring-palette-ring",
    "disabled:pointer-events-none disabled:opacity-50",
].join(" ");

/** A coloured call-to-action button (put a palette class next to it, e.g. `palette-blue`). */
export const solidButton = [
    "inline-flex h-8 items-center gap-1.5 rounded-md bg-palette-base px-3 text-sm font-medium text-palette-contrast",
    "outline-none hover:bg-palette-base-hover focus-visible:ring-2 focus-visible:ring-palette-ring focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
].join(" ");

/** An example's toolbar, above the layout. */
export const toolbar =
    "palette-surface flex flex-wrap items-center gap-2 border-b border-palette-line bg-palette-base px-3 py-2 text-palette-contrast";

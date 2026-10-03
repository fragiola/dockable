import type { DropIndicatorState } from "@fragiola/dockable-react";
import { cn } from "#/lib/cn";

// How drop-indicator-colours looks: one class string per part, read by index.tsx. The indicator's
// colour is the point of the example: see `dropIndicator` below.

// ─── the colours ────────────────────────────────────────────────────────────

/** Where a drop lands: one of the four named tabsets, another tabset, or the layout's edge. */
export type Region =
    | "inbox"
    | "review"
    | "archive"
    | "trash"
    | "other"
    | "edge";

/** The named tabsets, by id. */
const REGIONS: Partial<Record<string, Region>> = {
    inbox: "inbox",
    review: "review",
    archive: "archive",
    trash: "trash",
};

/** The region of a drop: the layout's edge for an edge drop, else the targeted tabset's. */
function regionOf(state: DropIndicatorState): Region {
    if (state.kind === "edge") return "edge";
    const tabsetId = state.targetTabsetId;
    return (tabsetId !== undefined && REGIONS[tabsetId]) || "other";
}

/** Each region's palette: a complete class each (Tailwind finds classes by reading the source). */
const PALETTES: Record<Region, string> = {
    inbox: "palette-green",
    review: "palette-orange",
    archive: "palette-purple",
    trash: "palette-danger",
    other: "palette-rose",
    edge: "palette-blue",
};

/** A drop beside a tabset thickens the side it docks to. */
const SIDES: Record<DropIndicatorState["location"], string> = {
    center: "",
    start: "border-s-8",
    end: "border-e-8",
    top: "border-t-8",
    bottom: "border-b-8",
};

/**
 * The indicator: the region picks the palette, the drop picks the fill. Into a tabset: filled.
 * Beside it: lighter, with a thick border on the docking side. At the layout's edge: striped.
 * Panels are portalled into the root after the indicator: `z-20` paints it above them.
 */
export const dropIndicator = (state: DropIndicatorState) =>
    cn(
        "z-20 rounded-(--dk-radius) border-2 border-palette-base transition-[left,top,width,height,background-color,border-color] duration-(--dk-motion)",
        PALETTES[regionOf(state)],
        state.kind === "edge"
            ? "[background:repeating-linear-gradient(135deg,color-mix(in_oklab,var(--palette-base)_40%,transparent)_0_8px,color-mix(in_oklab,var(--palette-base)_12%,transparent)_8px_16px)]"
            : state.location === "center"
              ? "bg-palette-base/35"
              : "bg-palette-base/15",
        SIDES[state.location],
    );

// ─── the legend ─────────────────────────────────────────────────────────────

export const legend =
    "palette-surface flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-palette-line bg-palette-base px-3 py-2 text-palette-contrast";

export const legendList =
    "m-0 flex list-none flex-wrap items-center gap-x-4 gap-y-1 p-0";

export const legendItem = "inline-flex items-center gap-1.5 text-sm";

export const swatch = (region: Region) =>
    cn("size-3 rounded-full bg-palette-base", PALETTES[region]);

export const legendHint = "text-xs text-palette-accent";

// ─── the layout ─────────────────────────────────────────────────────────────

/** The root needs a size; the gutter goes on this wrapper (padding on the root would not move
 * its row, which is `position: absolute; inset: 0`). */
export const frame = "flex min-h-0 flex-1 flex-col p-(--dk-gap)";

export const root =
    "palette-surface min-h-0 flex-1 bg-palette-base font-(family-name:--dk-font) text-palette-contrast";

/** Panels sit in a layer above the tabsets, whose overflow cannot clip them: the panel repeats
 * the tabset's inner radius on its corners. */
export const panel =
    "palette-raised overflow-auto rounded-b-[max(0px,calc(var(--dk-radius)-var(--dk-border)))] bg-palette-base bg-(image:--dk-panel-texture) text-palette-contrast";

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

/** `--dk-splitter-size` thick (the engine measures it), with a wider grab area (`::after`). */
export const splitter = cn(
    "relative z-10 shrink-0 bg-(--dk-splitter-bg) outline-none",
    "after:absolute after:transition-colors after:duration-(--dk-motion)",
    "hover:after:bg-palette-ring/30 data-dragging:after:bg-palette-ring/60 focus-visible:after:bg-palette-ring/60",
    "data-[orientation=vertical]:w-(--dk-splitter-size) data-[orientation=vertical]:cursor-ew-resize",
    "data-[orientation=vertical]:after:inset-y-0 data-[orientation=vertical]:after:start-1/2",
    "data-[orientation=vertical]:after:w-(--dk-splitter-grab) data-[orientation=vertical]:after:-translate-x-1/2",
    "rtl:data-[orientation=vertical]:after:translate-x-1/2",
    "data-[orientation=horizontal]:h-(--dk-splitter-size) data-[orientation=horizontal]:cursor-ns-resize",
    "data-[orientation=horizontal]:after:inset-x-0 data-[orientation=horizontal]:after:top-1/2",
    "data-[orientation=horizontal]:after:h-(--dk-splitter-grab) data-[orientation=horizontal]:after:-translate-y-1/2",
);

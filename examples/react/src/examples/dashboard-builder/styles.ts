import type { DropIndicatorState } from "@fragiola/dockable-react";
import { cn } from "#/lib/cn";

// How dashboard-builder looks: one class string per part, read by index.tsx and widgets.tsx.

// ─── page ───

export const page = "flex min-h-0 flex-1 flex-col";

export const toolbar =
    "palette-surface flex flex-wrap items-center gap-2 border-b border-palette-line bg-palette-base px-3 py-2 text-palette-contrast";

export const title = "text-sm font-semibold";

export const actions = "ms-auto flex gap-2";

export const button = cn(
    "inline-flex h-8 items-center gap-1.5 rounded-md border border-palette-line bg-palette-base px-3 text-sm",
    "text-palette-contrast outline-none hover:bg-palette-soft focus-visible:ring-2 focus-visible:ring-palette-ring",
    "disabled:pointer-events-none disabled:opacity-50",
);

export const primaryButton = cn(
    "palette-blue inline-flex h-8 items-center gap-1.5 rounded-md bg-palette-base px-3 text-sm font-medium text-palette-contrast",
    "outline-none hover:bg-palette-base-hover focus-visible:ring-2 focus-visible:ring-palette-ring focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
);

export const buttonIcon = "size-4";

export const alert =
    "palette-danger border-b border-palette-line bg-palette-base px-3 py-2 text-sm text-palette-contrast";

export const issues = "mt-1 list-disc ps-5 font-mono text-xs";

export const body = "flex min-h-0 flex-1";

// ─── widget palette ───

export const widgetPalette =
    "palette-surface flex w-48 shrink-0 flex-col gap-3 overflow-y-auto border-e border-palette-line bg-palette-base p-3";

export const groupTitle =
    "pb-1.5 text-xs font-semibold tracking-wide text-palette-accent/85 uppercase";

export const groupList = "flex flex-col gap-1.5";

export const paletteHint = "mt-auto text-xs text-palette-accent/85";

export const paletteItem = cn(
    "palette-raised flex cursor-grab items-center gap-2 rounded-(--dk-radius) border border-palette-line",
    "bg-palette-base px-2.5 py-2 text-sm hover:bg-palette-soft data-dragging:opacity-50",
);

export const paletteItemIcon = "size-4 shrink-0 text-palette-accent/85";

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

/** A dashed border on the empty canvas, and an outline on every tabset while a drag is over the
 * layout. */
export const tabset = cn(
    "palette-raised rounded-(--dk-radius) border-(length:--dk-border) border-palette-line bg-palette-base text-palette-contrast shadow-(--dk-shadow) data-active:border-(--dk-tabset-active-line)",
    "data-empty:border-dashed",
    // while any drag is over the layout the root carries data-dragging
    "in-data-dragging:outline-2 in-data-dragging:outline-offset-2 in-data-dragging:outline-palette-line in-data-dragging:outline-dashed",
);

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

export const tabIcon = "size-3.5 shrink-0";

export const tabName = "truncate";

/** The active tabset's marker: `in-data-active:` reads the enclosing TabSet's data-active,
 * `group-data-selected/tab:` this tab's. */
export const tabMarker =
    "palette-blue pointer-events-none absolute inset-x-2 bottom-0 hidden h-0.5 rounded-full bg-palette-base in-data-active:group-data-selected/tab:[display:var(--dk-tab-marker)]";

export const emptyHint =
    "grid h-full place-content-center justify-items-center gap-2 p-4 text-center text-sm text-palette-accent/85";

export const emptyHintIcon = "size-7";

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

// ─── widgets ───

export const kpi = "flex h-full flex-col justify-center gap-1 p-4";

export const kpiLabel = "text-sm text-palette-accent/85";

export const kpiValue = "text-3xl font-semibold tabular-nums";

/** Green when the KPI went up, red when it went down. */
export const kpiChange = (up: boolean) =>
    up
        ? "palette-green text-sm text-palette-accent"
        : "palette-danger text-sm text-palette-accent";

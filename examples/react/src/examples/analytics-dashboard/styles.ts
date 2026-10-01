import type { DropIndicatorState } from "@fragiola/dockable-react";
import { cn } from "#/lib/cn";

// How analytics-dashboard looks: one class string per part, read by the .tsx files. Colours come
// from the palette roles and sizes from the theme's --dk-* tokens, so it works in every theme.

// ─── layout (index.tsx) ───

/** The whole example: the header above, the layout below. */
export const frame =
    "flex min-h-0 flex-1 flex-col font-(family-name:--dk-font)";

/** The root needs a size; the gutter goes on this wrapper (padding on the root would not move
 * its row, which is `position: absolute; inset: 0`). */
export const stage = "flex min-h-0 flex-1 flex-col p-(--dk-gap)";

export const root =
    "palette-surface min-h-0 flex-1 bg-palette-base font-(family-name:--dk-font) text-palette-contrast";

/** A popout window's content root, dressed like the main root. */
export const popout =
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

/** A KPI tab below target (`alert`) takes the danger palette. */
export const tab = (alert: boolean) =>
    cn(
        "group/tab relative flex h-(--dk-tab-height) max-w-60 shrink-0 cursor-pointer select-none items-center gap-1.5 px-3",
        "rounded-t-(--dk-tab-radius) font-(family-name:--dk-tab-font) text-(length:--dk-tab-size)",
        "border-e-(length:--dk-tab-divider) border-palette-line outline-none transition-colors duration-(--dk-motion) hover:bg-palette-soft",
        "focus-visible:ring-2 focus-visible:ring-palette-ring focus-visible:ring-inset",
        "data-selected:bg-(--dk-tab-selected-bg) data-dragging:opacity-40",
        alert
            ? "palette-danger text-palette-accent data-selected:text-palette-accent"
            : "text-palette-accent/85 data-selected:text-(--dk-tab-selected-fg)",
    );

/** The active tabset's marker: `in-data-active:` reads the enclosing TabSet's data-active,
 * `group-data-selected/tab:` this tab's. */
export const tabMarker =
    "palette-blue pointer-events-none absolute inset-x-2 bottom-0 hidden h-0.5 rounded-full bg-palette-base in-data-active:group-data-selected/tab:[display:var(--dk-tab-marker)]";

/** The tabset's header buttons, at the strip's end. */
export const toolbar = "flex items-center gap-0.5 pe-1";

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

// ─── tabs (tabs.tsx) ───

/** The widget's icon (or the warning) in its tab. */
export const tabIcon = "size-3.5 shrink-0";

export const tabName = "truncate";

/** Hidden until the tab is hovered or selected. */
export const tabClose = cn(
    "-me-1.5 grid size-6 shrink-0 place-items-center self-center rounded-sm text-palette-accent/85 opacity-0",
    "outline-none hover:bg-palette-soft hover:text-palette-contrast focus-visible:ring-2 focus-visible:ring-palette-ring",
    "group-hover/tab:opacity-100 group-data-selected/tab:opacity-100",
);

export const tabCloseIcon = "size-3";

/** Maximize, pop out and dock back. */
export const button = cn(
    "grid size-6 shrink-0 place-items-center self-center rounded-sm text-palette-accent/85",
    "outline-none hover:bg-palette-soft hover:text-palette-contrast focus-visible:ring-2 focus-visible:ring-palette-ring",
    "disabled:pointer-events-none disabled:opacity-40",
);

/** The dock-back icon, a size up from the others. */
export const dockBackIcon = "size-4";

export const buttonIcon = "size-3.5";

// ─── header (header.tsx) ───

export const header =
    "palette-surface flex flex-wrap items-center gap-3 border-b border-palette-line bg-palette-base px-3 py-2 text-palette-contrast";

export const title = "me-auto text-sm font-semibold";

export const selectTrigger = "h-8 w-40 py-0 text-sm";

/** Undo and redo, joined into one group. */
export const history = "flex items-center";

export const undoButton = cn(
    "inline-flex h-8 items-center gap-1.5 rounded-md rounded-e-none border border-palette-line bg-palette-base px-2 text-sm",
    "text-palette-contrast outline-none hover:bg-palette-soft focus-visible:ring-2 focus-visible:ring-palette-ring",
    "disabled:pointer-events-none disabled:opacity-50",
);

/** `-ms-px` overlaps the undo button's border. */
export const redoButton = cn(
    "-ms-px inline-flex h-8 items-center gap-1.5 rounded-md rounded-s-none border border-palette-line bg-palette-base px-2 text-sm",
    "text-palette-contrast outline-none hover:bg-palette-soft focus-visible:ring-2 focus-visible:ring-palette-ring",
    "disabled:pointer-events-none disabled:opacity-50",
);

export const addButton = cn(
    "palette-blue inline-flex h-8 items-center gap-1.5 rounded-md bg-palette-base px-3 text-sm font-medium text-palette-contrast",
    "outline-none hover:bg-palette-base-hover focus-visible:ring-2 focus-visible:ring-palette-ring focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
);

export const headerIcon = "size-4";

// ─── widgets (widgets.tsx) ───

export const chart = "flex h-full min-h-36 flex-col gap-1 p-3";

export const chartHeader =
    "flex flex-wrap items-center gap-x-3 gap-y-1 text-xs";

export const chartTotal = "text-base font-semibold tabular-nums";

export const legendItem = "flex items-center gap-1 text-palette-accent/85";

/** The series colour comes from the `style` prop. */
export const legendDot = "size-2 rounded-full";

export const segments = "ms-auto flex rounded-md border border-palette-line";

export const segmentsLegend = "sr-only";

/** One Line/Bar button; `aria-pressed` marks the chosen one. */
export const segment = [
    "h-6 px-2 text-xs text-palette-accent/85 outline-none first:rounded-s-md last:rounded-e-md",
    "hover:bg-palette-soft focus-visible:ring-2 focus-visible:ring-palette-ring",
    "aria-pressed:bg-palette-soft aria-pressed:text-palette-contrast",
].join(" ");

export const chartCanvas = "min-h-0 flex-1";

export const kpi = "flex min-h-full flex-col justify-center gap-3 p-4";

export const kpiTitle = "text-sm text-palette-accent/85";

/** A KPI below target shows its value in the danger palette. */
export const kpiValue = (status: "ok" | "alert") =>
    cn(
        "text-4xl font-semibold tabular-nums",
        status === "alert" && "palette-danger text-palette-accent",
    );

export const kpiFooter = "flex flex-wrap items-center gap-2 text-sm";

export const kpiBadge = (status: "ok" | "alert") =>
    status === "alert" ? "palette-danger" : "palette-green";

export const kpiThreshold = "flex items-center gap-2 text-palette-accent/85";

export const kpiInput =
    "h-7 w-20 rounded-md border border-palette-line bg-palette-soft px-2 text-palette-contrast tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-palette-ring";

export const orders = "p-3";

export const amountHead = "text-end";

export const orderId = "tabular-nums";

export const amount = "text-end tabular-nums";

/** An order's status badge. */
export const orderStatus = {
    Paid: "palette-green",
    Pending: "palette-orange",
    Refunded: "palette-danger",
};

import type { DropIndicatorState } from "@fragiola/dockable-react";
import { cn } from "#/lib/cn";
import type { LogEntry } from "./commands";

// How layout-lab looks: one class string per part, read by index.tsx and panels.tsx. Colours come
// from the palette roles and sizes from the theme's --dk-* tokens, so it works in every theme.

export const lab = "flex min-h-0 flex-1 font-(family-name:--dk-font)";

export const main = "flex min-w-0 flex-1 flex-col";

// ─── toolbar ───

export const toolbar =
    "palette-surface flex flex-wrap items-center gap-2 border-b border-palette-line bg-palette-base px-3 py-2 text-palette-contrast";

export const history = "flex items-center";

export const undoButton = cn(
    "inline-flex h-8 items-center gap-1.5 rounded-md rounded-e-none border border-palette-line bg-palette-base px-2 text-sm",
    "text-palette-contrast outline-none hover:bg-palette-soft focus-visible:ring-2 focus-visible:ring-palette-ring",
    "disabled:pointer-events-none disabled:opacity-50",
);

export const redoButton = cn(
    "-ms-px inline-flex h-8 items-center gap-1.5 rounded-md rounded-s-none border border-palette-line bg-palette-base px-2 text-sm",
    "text-palette-contrast outline-none hover:bg-palette-soft focus-visible:ring-2 focus-visible:ring-palette-ring",
    "disabled:pointer-events-none disabled:opacity-50",
);

export const button = cn(
    "inline-flex h-8 items-center gap-1.5 rounded-md border border-palette-line bg-palette-base px-3 text-sm",
    "text-palette-contrast outline-none hover:bg-palette-soft focus-visible:ring-2 focus-visible:ring-palette-ring",
    "disabled:pointer-events-none disabled:opacity-50",
);

export const buttonIcon = "size-4";

export const vetoSlot = "ms-auto";

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

/** A card's text, in a panel. */
export const cardText = "max-w-prose text-sm leading-6 text-palette-accent/85";

/** Panels are portalled into the root after the indicator: `z-20` paints it above them. */
export const dropIndicator = (state: DropIndicatorState) =>
    cn(
        "z-20 rounded-(--dk-radius) border-2 [border-style:var(--dk-indicator-style)] border-palette-base transition-[left,top,width,height] duration-(--dk-motion)",
        state.kind === "edge"
            ? "palette-orange bg-palette-base/25"
            : "palette-blue bg-palette-base/20",
    );

// ─── tabs ───

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

export const tabClose = cn(
    "-me-1.5 grid size-5 shrink-0 place-items-center self-center rounded-sm text-palette-accent/85",
    "outline-none hover:bg-palette-soft hover:text-palette-contrast focus-visible:ring-2 focus-visible:ring-palette-ring",
);

export const tabCloseIcon = "size-3";

/** The active tabset's marker: `in-data-active:` reads the enclosing TabSet's data-active,
 * `group-data-selected/tab:` this tab's. */
export const tabMarker =
    "palette-blue pointer-events-none absolute inset-x-2 bottom-0 hidden h-0.5 rounded-full bg-palette-base in-data-active:group-data-selected/tab:[display:var(--dk-tab-marker)]";

// ─── borders ───

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
    // a side border's labels turn with `writing-mode`; a start border that
    // reads "up" (`data-tab-direction`) turns them half a turn more
    "in-data-[orientation=vertical]:[writing-mode:vertical-rl] in-data-[orientation=vertical]:px-1 in-data-[orientation=vertical]:py-2",
    "in-data-[tab-direction=up]:rotate-180",
);

/** An overlay border paints over the layout: a stacking order, a shadow and a line on the side
 * facing the layout. */
export const borderContent = cn(
    "data-overlay:z-30 data-overlay:shadow-xl data-overlay:border-palette-line",
    "data-overlay:data-[location=start]:border-e data-overlay:data-[location=end]:border-s",
    "data-overlay:data-[location=top]:border-b data-overlay:data-[location=bottom]:border-t",
);

// ─── splitter ───

/** `--dk-splitter-size` thick (the engine measures it), with a wider grab area (`::after`). */
export const splitter = cn(
    "group/splitter relative z-10 flex shrink-0 items-center justify-center bg-(--dk-splitter-bg) outline-none",
    // an overlay border's splitter lies over the layout, not a gutter: it gets the
    // surface underneath, with the theme's splitter colour layered on top
    "in-data-overlay:bg-palette-base in-data-overlay:bg-[image:linear-gradient(var(--dk-splitter-bg),var(--dk-splitter-bg))]",
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

// ─── JSON editor ───

export const jsonEditor =
    "palette-surface flex w-72 shrink-0 flex-col border-e border-palette-line bg-palette-base max-md:hidden";

export const jsonHeader =
    "flex h-11 shrink-0 items-center gap-2 border-b border-palette-line px-3";

export const jsonTitle = "me-auto text-sm font-semibold";

export const revertButton = cn(
    "inline-flex h-7 items-center gap-1.5 rounded-md border border-palette-line bg-palette-base px-2 text-xs",
    "text-palette-contrast outline-none hover:bg-palette-soft focus-visible:ring-2 focus-visible:ring-palette-ring",
    "disabled:pointer-events-none disabled:opacity-50",
);

export const applyButton = cn(
    "palette-blue inline-flex h-7 items-center gap-1.5 rounded-md bg-palette-base px-2 text-xs font-medium text-palette-contrast",
    "outline-none hover:bg-palette-base-hover focus-visible:ring-2 focus-visible:ring-palette-ring focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
);

export const jsonText =
    "min-h-0 flex-1 resize-none bg-transparent p-3 font-mono text-xs leading-5 text-palette-contrast outline-none focus-visible:ring-2 focus-visible:ring-palette-ring focus-visible:ring-inset";

export const jsonError =
    "palette-danger max-h-40 overflow-auto border-t border-palette-line bg-palette-soft px-3 py-2 text-xs text-palette-accent";

export const jsonIssues = "mt-1 flex flex-col gap-0.5 font-mono";

export const jsonIssuePath = "font-semibold";

// ─── veto ───

export const veto = "flex items-center gap-2 text-sm";

export const vetoSwitch = "flex items-center gap-2";

export const vetoTrigger = "h-8 w-40 py-0 font-mono text-xs";

export const vetoItem = "font-mono text-xs";

// ─── command log ───

export const log =
    "palette-surface flex h-36 shrink-0 flex-col border-t border-palette-line bg-palette-base";

export const logHeader = "flex h-8 shrink-0 items-center gap-2 px-3";

export const logTitle = "me-auto text-xs font-semibold";

export const logCount = "ms-2 font-normal text-palette-accent/85";

export const clearButton = cn(
    "inline-flex h-6 items-center gap-1.5 rounded-md border border-palette-line bg-palette-base px-2 text-xs",
    "text-palette-contrast outline-none hover:bg-palette-soft focus-visible:ring-2 focus-visible:ring-palette-ring",
    "disabled:pointer-events-none disabled:opacity-50",
);

export const logList =
    "min-h-0 flex-1 overflow-auto px-3 pb-2 font-mono text-xs leading-5";

export const logEmpty = "text-palette-accent/85";

export const logEntry = "flex gap-2 whitespace-nowrap";

/** Green when the command applied, red when it was refused. */
export const logOutcome = (outcome: LogEntry["outcome"]) =>
    cn(
        "min-w-14 shrink-0",
        outcome === "applied"
            ? "palette-green text-palette-accent"
            : "palette-danger text-palette-accent",
    );

export const logCommand = "shrink-0 font-semibold";

export const logPayload = "truncate text-palette-accent/85";

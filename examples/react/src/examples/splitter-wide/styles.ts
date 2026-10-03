import type {
    DropIndicatorState,
    SplitterState,
} from "@fragiola/dockable-react";
import { cn } from "#/lib/cn";

// How splitter-wide looks: one class string per part, read by index.tsx.

export const frame = "flex min-h-0 flex-1 flex-col p-(--dk-gap)";

export const root =
    "palette-surface min-h-0 flex-1 bg-palette-base font-(family-name:--dk-font) text-palette-contrast";

/** Panels sit in a layer above the tabsets, whose overflow cannot clip them: the panel repeats
 * the tabset's inner radius on its corners. */
export const panel =
    "palette-raised overflow-auto rounded-b-[max(0px,calc(var(--dk-radius)-var(--dk-border)))] bg-palette-base bg-(image:--dk-panel-texture) text-palette-contrast";

/** The demo content: the draft's paragraphs, the outline and the comments. */
export const paragraph = "max-w-prose leading-7 text-palette-accent/85";

export const outline = "list-decimal space-y-1 ps-5 text-sm";

export const comments = "flex flex-col gap-2 text-sm text-palette-accent/85";

export const commentAuthor = "font-medium text-palette-contrast";

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

// ─── the wide splitter ───

/** 12px thick (`w-3`/`h-3`, the engine measures it): a soft track that darkens on hover and
 * takes the ring colour while dragged. `vertical` is a bar between side-by-side panes. */
export const splitter = (state: SplitterState) =>
    cn(
        "group/splitter relative z-10 flex shrink-0 items-center justify-center rounded-full bg-palette-soft outline-none",
        "transition-colors duration-(--dk-motion) hover:bg-palette-line",
        "data-dragging:bg-palette-ring/50 focus-visible:ring-2 focus-visible:ring-palette-ring",
        state.orientation === "vertical"
            ? "w-3 cursor-ew-resize"
            : "h-3 cursor-ns-resize",
    );

/** The bubble with `aria-valuetext`, centred on the bar while it is dragged or focused. */
export const splitterReadout = cn(
    "palette-blue pointer-events-none absolute start-1/2 top-1/2 hidden -translate-1/2 rounded-md bg-palette-base px-1.5 py-0.5 rtl:translate-x-1/2",
    "text-xs font-medium tabular-nums text-palette-contrast shadow-sm",
    "group-focus-visible/splitter:block group-data-dragging/splitter:block",
);

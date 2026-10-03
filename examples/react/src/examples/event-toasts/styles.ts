import type { DropIndicatorState } from "@fragiola/dockable-react";
import { cn } from "#/lib/cn";

// How event-toasts looks: one class string per part, read by index.tsx and toasts.tsx.

// ─── the toolbar ────────────────────────────────────────────────────────────

export const toolbar =
    "palette-surface flex flex-wrap items-center justify-between gap-2 border-b border-palette-line bg-palette-base px-3 py-2 text-palette-contrast";

export const kinds = "inline-flex flex-wrap gap-1";

/** `aria-pressed`: this kind of command raises a toast. */
export const kind = cn(
    "inline-flex h-7 items-center rounded-full border border-palette-line px-3 text-xs text-palette-accent outline-none",
    "hover:bg-palette-soft focus-visible:ring-2 focus-visible:ring-palette-ring",
    "aria-pressed:border-transparent aria-pressed:bg-palette-contrast aria-pressed:text-palette-base",
);

export const button =
    "inline-flex h-8 items-center gap-1.5 rounded-md border border-palette-line px-3 text-sm outline-none hover:bg-palette-soft focus-visible:ring-2 focus-visible:ring-palette-ring";

export const icon = "size-4";

// ─── the toasts ─────────────────────────────────────────────────────────────

export type ToastTone = "neutral" | "info" | "success" | "danger";

const TONES: Record<ToastTone, string> = {
    neutral: "palette-raised",
    info: "palette-blue",
    success: "palette-green",
    danger: "palette-danger",
};

/** Over the layout, in its bottom corner: panels are portalled into the root, `z-30` clears them.
 * The list lets clicks through; each toast takes them. */
export const toaster =
    "pointer-events-none absolute end-4 bottom-4 z-30 m-0 flex w-72 list-none flex-col gap-2 p-0";

/** A toast filled with its tone's palette (`contrast` is the text that reads on `base`). */
export const toast = (tone: ToastTone) =>
    cn(
        "pointer-events-auto flex items-start gap-2 rounded-lg border border-palette-line bg-palette-base p-3 text-palette-contrast shadow-lg",
        "animate-in fade-in slide-in-from-bottom-2",
        TONES[tone],
    );

export const toastText = "min-w-0 flex-1";

export const toastTitle = "truncate text-sm font-medium";

export const toastDetail = "text-xs opacity-80";

export const toastAction =
    "shrink-0 rounded-md px-2 py-1 text-xs font-semibold underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-palette-ring";

export const toastDismiss =
    "grid size-6 shrink-0 place-items-center rounded-sm opacity-80 outline-none hover:opacity-100 focus-visible:ring-2 focus-visible:ring-palette-ring";

// ─── the layout ─────────────────────────────────────────────────────────────

/** The root needs a size; the gutter goes on this wrapper (padding on the root would not move
 * its row, which is `position: absolute; inset: 0`). `relative` places the toasts over it. */
export const frame = "relative flex min-h-0 flex-1 flex-col p-(--dk-gap)";

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

export const closeButton = cn(
    "grid size-5 shrink-0 place-items-center self-center rounded-sm text-palette-accent/85",
    "outline-none hover:bg-palette-soft hover:text-palette-contrast",
    "focus-visible:ring-2 focus-visible:ring-palette-ring",
);

export const closeIcon = "size-3.5";

export const stripButton = cn(
    "me-1 grid size-7 shrink-0 place-items-center self-center rounded-sm text-palette-accent/85",
    "outline-none hover:bg-palette-soft hover:text-palette-contrast",
    "focus-visible:ring-2 focus-visible:ring-palette-ring",
);

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

import { cn } from "#/lib/cn";

// How drop-target-highlight looks: one class string per part, read by index.tsx. The drop
// highlights read only the tabset's `data-drop-target` / `data-drop-location`.

/** The root needs a size; the gutter goes on this wrapper (padding on the root would not move
 * its row, which is `position: absolute; inset: 0`). */
export const frame = "flex min-h-0 flex-1 flex-col p-(--dk-gap)";

export const root =
    "palette-surface min-h-0 flex-1 bg-palette-base font-(family-name:--dk-font) text-palette-contrast";

/** Panels sit in a layer above the tabsets, whose overflow cannot clip them: the panel repeats
 * the tabset's inner radius on its corners. */
export const panel =
    "palette-raised overflow-auto rounded-b-[max(0px,calc(var(--dk-radius)-var(--dk-border)))] bg-palette-base bg-(image:--dk-panel-texture) text-palette-contrast";

export const tabset = cn(
    "palette-raised rounded-(--dk-radius) border-(length:--dk-border) border-palette-line bg-palette-base text-palette-contrast shadow-(--dk-shadow) data-active:border-(--dk-tabset-active-line)",
    // a bar on the side of the tabset the drag would dock to (or all around, for the centre)
    "data-drop-target:ring-2 data-drop-target:ring-palette-ring/40",
    "data-[drop-location=center]:ring-4 data-[drop-location=center]:ring-palette-ring",
    "data-[drop-location=top]:shadow-[inset_0_4px_0_var(--palette-ring)]",
    "data-[drop-location=bottom]:shadow-[inset_0_-4px_0_var(--palette-ring)]",
    "data-[drop-location=left]:shadow-[inset_4px_0_0_var(--palette-ring)]",
    "data-[drop-location=right]:shadow-[inset_-4px_0_0_var(--palette-ring)]",
    "transition-shadow duration-(--dk-motion)",
);

export const strip =
    "flex min-h-(--dk-tab-height) items-stretch border-b border-palette-line";

/** The start padding is load-bearing: a tab flush with the tabset's edge could not take a drop
 * before it (that edge is the tabset's side drop). */
export const tabList =
    "flex min-w-0 flex-1 items-end gap-(--dk-tab-gap) overflow-hidden bg-(--dk-strip-bg) ps-[max(0.25rem,var(--dk-strip-padding))] pt-[calc(var(--dk-strip-padding)/2)]";

/** `before`/`after`: the strip's insertion point is before this tab, or after it (the last). */
export const tab = (before: boolean, after: boolean) =>
    cn(
        "group/tab relative flex h-(--dk-tab-height) max-w-60 shrink-0 cursor-pointer select-none items-center gap-1.5 px-3",
        "rounded-t-(--dk-tab-radius) font-(family-name:--dk-tab-font) text-(length:--dk-tab-size) text-palette-accent/85",
        "border-e-(length:--dk-tab-divider) border-palette-line outline-none transition-colors duration-(--dk-motion) hover:bg-palette-soft",
        "focus-visible:ring-2 focus-visible:ring-palette-ring focus-visible:ring-inset",
        "data-selected:bg-(--dk-tab-selected-bg) data-selected:text-(--dk-tab-selected-fg) data-dragging:opacity-40",
        // a caret before (or after) the tab, at the strip's insertion point
        (before || after) &&
            "before:pointer-events-none before:absolute before:inset-y-1 before:w-0.5 before:rounded-full before:bg-palette-ring",
        before && "before:-start-0.5",
        after && "before:-end-0.5",
    );

export const tabName = "truncate";

/** The active tabset's marker: `in-data-active:` reads the enclosing TabSet's data-active,
 * `group-data-selected/tab:` this tab's. */
export const tabMarker =
    "palette-blue pointer-events-none absolute inset-x-2 bottom-0 hidden h-0.5 rounded-full bg-palette-base in-data-active:group-data-selected/tab:[display:var(--dk-tab-marker)]";

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

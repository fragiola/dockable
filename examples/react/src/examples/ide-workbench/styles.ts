import type { DropIndicatorState } from "@fragiola/dockable-react";
import { cn } from "#/lib/cn";
import type { Problem } from "./files";

// How ide-workbench looks: one class string per part, read by the .tsx files. Colours come from
// the palette roles and sizes from the theme's --dk-* tokens, so it works in every theme.

// ─── workbench (index.tsx) ───

export const workbench =
    "flex min-h-0 flex-1 flex-col font-(family-name:--dk-font)";

export const restoreProblem =
    "palette-orange flex shrink-0 items-start gap-3 border-b border-palette-line bg-palette-soft px-3 py-2 text-xs text-palette-contrast";

export const restoreProblemBody = "min-w-0 flex-1";

export const restoreProblemIssues = "mt-1 font-mono";

export const restoreProblemDismiss =
    "h-5 shrink-0 rounded-sm px-2 outline-none hover:bg-palette-base focus-visible:ring-1 focus-visible:ring-palette-ring";

/** Hairline splitters with a wider grab area, whatever the theme. */
export const stage =
    "flex min-h-0 min-w-0 flex-1 flex-col [--dk-splitter-grab:7px] [--dk-splitter-size:1px]";

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

export const statusBar =
    "palette-blue flex h-6 shrink-0 items-center gap-4 bg-palette-base px-3 text-xs text-palette-contrast";

export const statusBranch = "flex items-center gap-1";

export const statusBranchIcon = "size-3.5";

export const statusPath = "ms-auto";

export const saveButton = "palette-blue";

// ─── borders (index.tsx) ───

export const border = cn(
    "palette-surface shrink-0 bg-palette-base text-palette-contrast",
    // a side bar is as wide as its icon buttons
    "data-[orientation=vertical]:w-10 data-[orientation=horizontal]:h-(--dk-tab-height)",
    "data-[location=start]:border-e data-[location=end]:border-s data-[location=top]:border-b data-[location=bottom]:border-t border-palette-line",
    "data-drop-target:bg-palette-soft",
);

export const borderTabList =
    "flex min-h-0 min-w-0 flex-1 gap-(--dk-tab-gap) p-1 data-[orientation=vertical]:flex-col";

export const borderTabIcon = "size-4 shrink-0";

export const borderTab = (side: boolean) =>
    cn(
        "flex shrink-0 cursor-pointer select-none items-center gap-1.5 rounded-sm",
        "font-(family-name:--dk-tab-font) text-(length:--dk-tab-size) text-palette-accent/85",
        "outline-none hover:bg-palette-soft focus-visible:ring-2 focus-visible:ring-palette-ring focus-visible:ring-inset",
        "data-selected:bg-palette-soft data-selected:text-palette-contrast data-dragging:opacity-40",
        // upright and centred in a side bar: no writing-mode, no rotation
        side ? "justify-center p-2" : "px-2 py-1",
    );

export const borderTabTooltip = "grid place-items-center";

/** An overlay border paints over the layout: a stacking order (above the tabsets and their
 * splitters), a shadow and a line on the side facing the layout. */
export const borderContent = cn(
    "data-overlay:z-30 data-overlay:shadow-xl data-overlay:border-palette-line",
    "data-overlay:data-[location=start]:border-e data-overlay:data-[location=end]:border-s",
    "data-overlay:data-[location=top]:border-b data-overlay:data-[location=bottom]:border-t",
);

// ─── splitter (index.tsx) ───

/** `--dk-splitter-size` thick (the engine measures it), with a wider grab area (`::after`). */
export const splitter = cn(
    "group/splitter relative z-10 flex shrink-0 items-center justify-center bg-(--dk-splitter-bg) outline-none",
    // an overlay border's splitter lies over the layout, not a gutter: it gets the surface
    // underneath, with the theme's splitter colour layered on top
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

// ─── tabsets (tabs.tsx) ───

export const tabset =
    "palette-raised rounded-(--dk-radius) border-(length:--dk-border) border-palette-line bg-palette-base text-palette-contrast shadow-(--dk-shadow) data-active:border-(--dk-tabset-active-line) data-maximized:shadow-none";

export const strip =
    "flex min-h-(--dk-tab-height) items-stretch border-b border-palette-line";

export const tabList =
    "flex min-w-0 flex-1 items-end gap-(--dk-tab-gap) overflow-hidden bg-(--dk-strip-bg) ps-(--dk-strip-padding) pt-[calc(var(--dk-strip-padding)/2)]";

export const tabsetActions = "flex items-center gap-0.5 pe-1";

export const overflowTrigger = "h-6 min-w-0 gap-1 rounded-sm px-2 py-0 text-xs";

export const maximizeButton = cn(
    "grid size-6 shrink-0 place-items-center self-center rounded-sm text-palette-accent/85",
    "outline-none hover:bg-palette-soft hover:text-palette-contrast focus-visible:ring-2 focus-visible:ring-palette-ring",
);

export const maximizeIcon = "size-3.5";

export const emptyState =
    "grid h-full place-items-center p-4 text-center text-sm text-palette-accent/85";

// ─── tabs (tabs.tsx) ───

export const tab = cn(
    "group/tab relative flex h-(--dk-tab-height) max-w-60 shrink-0 cursor-pointer select-none items-center gap-1.5 ps-2.5 pe-1",
    "rounded-t-(--dk-tab-radius) font-(family-name:--dk-tab-font) text-(length:--dk-tab-size) text-palette-accent/85",
    "border-e-(length:--dk-tab-divider) border-palette-line outline-none transition-colors duration-(--dk-motion) hover:bg-palette-soft",
    "focus-visible:ring-2 focus-visible:ring-palette-ring focus-visible:ring-inset",
    "data-selected:bg-(--dk-tab-selected-bg) data-selected:text-(--dk-tab-selected-fg) data-dragging:opacity-40",
    // the active tabset's marker, drawn as the selected tab's ::after (`in-data-active:` reads
    // the enclosing TabSet's data-active); the theme sets its colour and display
    "after:pointer-events-none after:absolute after:inset-x-2 after:bottom-0 after:hidden after:h-0.5 after:rounded-full after:bg-(--dk-tab-marker-color) in-data-active:data-selected:after:[display:var(--dk-tab-marker)]",
);

export const tabIcon = "size-3.5 shrink-0";

export const tabName = "truncate";

export const closeButton = cn(
    "grid size-5 shrink-0 place-items-center self-center rounded-sm text-palette-accent/85",
    "outline-none hover:bg-palette-soft hover:text-palette-contrast focus-visible:ring-2 focus-visible:ring-palette-ring",
);

/** VS Code's convention: a dot while modified, the cross on hover. */
export const dirtyDot =
    "size-2 rounded-full bg-palette-contrast group-hover/tab:hidden";

export const closeIcon = (dirty: boolean) =>
    cn(
        "size-3.5",
        dirty
            ? "hidden group-hover/tab:block"
            : "opacity-0 group-hover/tab:opacity-100 group-data-selected/tab:opacity-100",
    );

// ─── explorer (explorer.tsx) ───

/** A file type's colour, through a palette (so every theme recolours it). */
export type FileTone = "orange" | "green" | "purple" | "blue";

const fileTones: Record<FileTone, string> = {
    orange: "palette-orange",
    green: "palette-green",
    purple: "palette-purple",
    blue: "palette-blue",
};

export const fileIcon = (tone: FileTone, className?: string) =>
    cn(fileTones[tone], "size-3.5 shrink-0 text-palette-accent", className);

export const explorer = "flex h-full min-w-0 flex-col";

export const explorerHeader =
    "flex h-(--dk-tab-height) min-h-8 items-center justify-between ps-3 pe-1 text-[11px] font-semibold tracking-wider text-palette-accent/85 uppercase";

export const resetButton =
    "grid size-6 place-items-center rounded-sm outline-none hover:bg-palette-soft hover:text-palette-contrast focus-visible:ring-1 focus-visible:ring-palette-ring";

export const resetIcon = "size-3.5";

export const explorerTree = "min-h-0 flex-1 overflow-auto pb-2";

const row = [
    "flex h-6 w-full items-center gap-1.5 pe-2 text-start text-[13px] outline-none",
    "text-palette-accent/85 hover:bg-palette-soft hover:text-palette-contrast",
    "focus-visible:ring-1 focus-visible:ring-palette-ring focus-visible:ring-inset",
].join(" ");

export const folderRow = cn(row, "ps-2");

export const folderChevron = (open: boolean) =>
    cn(
        "size-3.5 shrink-0 transition-transform rtl:-scale-x-100",
        open && "rotate-90 rtl:-rotate-90",
    );

/** A file in a folder is indented under it. */
export const fileRow = (inFolder: boolean) =>
    cn(
        row,
        inFolder ? "ps-7" : "ps-3",
        "aria-[current]:bg-palette-soft aria-[current]:text-palette-contrast",
    );

export const fileName = "truncate";

export const fileModified =
    "ms-auto size-2 shrink-0 rounded-full bg-palette-accent";

// ─── editor (panels.tsx) ───

export const editor = "flex h-full flex-col";

export const breadcrumbs =
    "flex h-7 shrink-0 items-center gap-1 border-b border-palette-line ps-3 pe-1 text-xs text-palette-accent/85";

export const crumb = "flex items-center gap-1";

/** The last part of the path (the file) stands out. */
export const crumbName = (last: boolean) => cn(last && "text-palette-contrast");

export const editorSave =
    "ms-auto h-5 rounded-sm px-2 outline-none hover:bg-palette-soft hover:text-palette-contrast focus-visible:ring-1 focus-visible:ring-palette-ring disabled:opacity-50";

export const editorBody =
    "flex min-h-0 flex-1 overflow-auto font-mono text-[13px] leading-5";

export const lineNumbers =
    "sticky start-0 m-0 shrink-0 bg-palette-base py-2 ps-4 pe-3 text-end text-palette-accent/60 select-none";

export const editorText =
    "min-h-full min-w-0 flex-1 resize-none bg-transparent py-2 pe-4 whitespace-pre text-palette-contrast outline-none [field-sizing:content]";

// ─── terminal (panels.tsx) ───

export const terminal =
    "flex min-h-full flex-col p-2 font-mono text-xs leading-5";

export const terminalLine = "whitespace-pre-wrap";

export const terminalForm = "flex items-center gap-2";

export const terminalPrompt = "text-palette-accent/85";

export const terminalInput = "min-w-0 flex-1 bg-transparent outline-none";

// ─── problems (panels.tsx) ───

export const problems = "py-1 text-[13px]";

export const problem =
    "flex w-full items-center gap-2 px-3 py-1 text-start outline-none hover:bg-palette-soft focus-visible:ring-1 focus-visible:ring-palette-ring focus-visible:ring-inset";

/** An error's icon in the danger palette, a warning's in orange. */
export const problemIcon = (severity: Problem["severity"]) =>
    cn(
        severity === "error" ? "palette-danger" : "palette-orange",
        "size-3.5 shrink-0 text-palette-accent",
    );

export const problemMessage = "truncate";

export const problemLocation =
    "ms-auto shrink-0 text-xs text-palette-accent/85";

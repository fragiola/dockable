import type { DropIndicatorState } from "@fragiola/dockable-react";
import { cn } from "#/lib/cn";
import type { Level } from "./simulation";

// How ops-monitor looks: one class string per part, read by index.tsx, tabs.tsx and panels.tsx.

/** A status as a palette: the same mapping colours tabs, badges and log lines. */
export const levelPalette: Record<Level | "info", string> = {
    ok: "palette-green",
    warning: "palette-orange",
    critical: "palette-danger",
    info: "",
};

/** A service tab's palette: none until its panel has written a status. */
const statusPalette = (status: Level | undefined) =>
    status ? levelPalette[status] : "";

// ─── toolbar ───

export const shell =
    "flex min-h-0 flex-1 flex-col font-(family-name:--dk-font)";

export const toolbar =
    "palette-surface flex flex-wrap items-center gap-2 border-b border-palette-line bg-palette-base px-3 py-2 text-palette-contrast";

export const liveControl = "flex items-center gap-2 text-sm";

export const liveLabel = (live: boolean) =>
    cn(live && "palette-green text-palette-accent");

export const shortcutHint =
    "ms-auto hidden text-xs text-palette-accent/85 lg:inline";

export const serviceSelect = "h-8 w-36 py-0 text-sm";

export const dangerButton = cn(
    "palette-danger inline-flex h-8 items-center gap-1.5 rounded-md bg-palette-base px-3 text-sm font-medium text-palette-contrast",
    "outline-none hover:bg-palette-base-hover focus-visible:ring-2 focus-visible:ring-palette-ring focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
);

export const buttonIcon = "size-4";

export const button = cn(
    "inline-flex h-8 items-center gap-1.5 rounded-md border border-palette-line bg-palette-base px-3 text-sm text-palette-contrast",
    "outline-none hover:bg-palette-soft focus-visible:ring-2 focus-visible:ring-palette-ring",
    "disabled:pointer-events-none disabled:opacity-50",
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

/** Panels are portalled into the root after the indicator: `z-20` paints it above them. */
export const dropIndicator = (state: DropIndicatorState) =>
    cn(
        "z-20 rounded-(--dk-radius) border-2 [border-style:var(--dk-indicator-style)] border-palette-base transition-[left,top,width,height] duration-(--dk-motion)",
        state.kind === "edge"
            ? "palette-orange bg-palette-base/25"
            : "palette-blue bg-palette-base/20",
    );

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

// ─── tabsets and tabs ───

/** A locked tabset (`data-locked`) has a dashed border. */
export const tabset = cn(
    "palette-raised rounded-(--dk-radius) border-(length:--dk-border) border-palette-line bg-palette-base text-palette-contrast shadow-(--dk-shadow) data-active:border-(--dk-tabset-active-line)",
    "data-locked:border-dashed",
);

export const strip =
    "flex min-h-(--dk-tab-height) items-stretch border-b border-palette-line";

/** The start padding is load-bearing: a tab flush with the tabset's edge could not take a drop
 * before it (that edge is the tabset's side drop). */
export const tabList =
    "flex min-w-0 flex-1 items-end gap-(--dk-tab-gap) overflow-hidden bg-(--dk-strip-bg) ps-[max(0.25rem,var(--dk-strip-padding))] pt-[calc(var(--dk-strip-padding)/2)]";

/** The tab's own surface stays the theme's (selected, hover, active); the status colours only
 * its icon, a line on top and a badge. */
export const tab = cn(
    "group/tab relative flex h-(--dk-tab-height) max-w-60 shrink-0 cursor-pointer select-none items-center gap-1.5 px-3",
    "rounded-t-(--dk-tab-radius) font-(family-name:--dk-tab-font) text-(length:--dk-tab-size) text-palette-accent/85",
    "border-e-(length:--dk-tab-divider) border-palette-line outline-none transition-colors duration-(--dk-motion) hover:bg-palette-soft",
    "focus-visible:ring-2 focus-visible:ring-palette-ring focus-visible:ring-inset",
    "data-selected:bg-(--dk-tab-selected-bg) data-selected:text-(--dk-tab-selected-fg) data-dragging:opacity-40",
    // a pinned tab is only its icon: a narrower button
    "data-pinned:px-2.5",
);

/** Coloured by the tab's `data-status` (warning, critical), pulsing while critical. */
export const tabIcon = (status: Level | undefined) =>
    cn(
        statusPalette(status),
        "size-3.5 shrink-0",
        "group-data-[status=warning]/tab:text-palette-base group-data-[status=critical]/tab:text-palette-base",
        "motion-safe:group-data-[status=critical]/tab:animate-pulse",
    );

/** A pinned tab is only its icon: its name stays for screen readers. */
export const tabName = (pinned: boolean | undefined) =>
    cn("truncate", pinned && "sr-only");

export const alertsLabel = "sr-only";

export const alertBadge = (status: Level | undefined) =>
    cn(
        statusPalette(status),
        "grid h-4 min-w-4 place-items-center rounded-full bg-palette-base px-1 font-sans text-[10px] font-semibold text-palette-contrast tabular-nums",
    );

/** The line on top of the tab, shown by its `data-status` (warning, critical). */
export const statusLine = (status: Level | undefined) =>
    cn(
        statusPalette(status),
        "pointer-events-none absolute inset-x-0 top-0 hidden h-0.5 bg-palette-base",
        "group-data-[status=warning]/tab:block group-data-[status=critical]/tab:block",
    );

/** The active tabset's marker: `in-data-active:` reads the enclosing TabSet's data-active,
 * `group-data-selected/tab:` this tab's. */
export const tabMarker =
    "palette-blue pointer-events-none absolute inset-x-2 bottom-0 hidden h-0.5 rounded-full bg-palette-base in-data-active:group-data-selected/tab:[display:var(--dk-tab-marker)]";

/** The tabset's buttons, at the end of the strip. */
export const tabsetButtons = "flex items-center gap-0.5 pe-1";

export const lockButton = cn(
    "grid size-6 shrink-0 place-items-center self-center rounded-sm text-palette-accent/85",
    "outline-none hover:bg-palette-soft hover:text-palette-contrast focus-visible:ring-2 focus-visible:ring-palette-ring",
    "disabled:pointer-events-none disabled:opacity-40",
);

export const lockIcon = "size-3.5";

export const tooltip = "palette-surface";

// ─── panels ───

export const servicePanel = "flex h-full min-h-40 flex-col gap-2 p-3";

export const metrics = "flex flex-wrap items-center gap-x-4 gap-y-1 text-xs";

export const statusBadge = (level: Level) => levelPalette[level];

export const metric = "flex items-baseline gap-1.5";

export const metricTerm = "text-palette-accent/85";

export const metricValue = "text-sm font-semibold tabular-nums";

/** The chart takes the level's palette. */
export const chartArea = (level: Level) =>
    cn("min-h-0 flex-1", levelPalette[level]);

export const chart = "h-full";

export const overviewPanel = "p-3";

export const headEnd = "text-end";

export const headCpu = "w-1/3";

export const cell = "py-1.5";

export const cellNumber = "py-1.5 text-end tabular-nums";

export const serviceLink =
    "underline-offset-2 outline-none hover:underline focus-visible:underline";

/** Over 80% CPU, the bar turns critical. */
export const cpuBar = (busy: boolean) => levelPalette[busy ? "critical" : "ok"];

export const eventsPanel =
    "flex flex-col gap-0.5 p-3 font-mono text-xs leading-5";

export const eventLine = "flex gap-2";

export const eventTime = "text-palette-accent/85";

export const eventLevel = (level: Level | "info") =>
    cn(
        "w-16 shrink-0 uppercase",
        level === "info"
            ? "text-palette-accent/85"
            : `${levelPalette[level]} text-palette-accent`,
    );

export const runbookPanel = "flex flex-col gap-3 p-3 text-sm";

export const incidentStatus = (active: boolean) =>
    cn(
        active
            ? "palette-danger text-palette-accent"
            : "text-palette-accent/85",
    );

export const steps = "flex flex-col gap-1.5";

export const stepLabel = "flex items-start gap-2";

export const stepCheck = "mt-0.5 accent-(--palette-ring)";

export const stepText = (done: boolean) =>
    cn(done && "text-palette-accent/85 line-through");

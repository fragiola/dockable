import type { DropIndicatorState } from "@fragiola/dockable-react";
import { cn } from "#/lib/cn";

// How trading-workstation looks: one class string per part, read by index.tsx, tabs.tsx and
// panels.tsx. Colours come from the palette roles and sizes from the theme's --dk-* tokens, so it
// works in every theme. Rises are the green palette, falls the danger one.

type Tone = "up" | "down" | "flat";

/** A tone as a palette: the same mapping colours prices, candles, P&L and badges. */
const tonePalette: Record<Tone, string> = {
    up: "palette-green",
    down: "palette-danger",
    flat: "",
};

/** A figure in its tone: the palette's accent, readable on the panel. */
const toned = (tone: Tone) =>
    cn(tonePalette[tone], tone !== "flat" && "text-palette-accent");

// ─── toolbar (index.tsx) ───

export const shell =
    "flex min-h-0 flex-1 flex-col font-(family-name:--dk-font)";

export const toolbar =
    "palette-surface flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-palette-line bg-palette-base px-3 py-1.5 text-sm text-palette-contrast";

export const button = cn(
    "inline-flex h-7 items-center gap-1.5 rounded-md border border-palette-line bg-palette-base px-2.5 text-sm text-palette-contrast",
    "outline-none hover:bg-palette-soft focus-visible:ring-2 focus-visible:ring-palette-ring",
);

export const ghostButton = cn(
    "ms-auto inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-sm text-palette-accent/85",
    "outline-none hover:bg-palette-soft hover:text-palette-contrast focus-visible:ring-2 focus-visible:ring-palette-ring",
);

export const buttonIcon = "size-3.5";

export const feedState = (playing: boolean) =>
    cn(
        "inline-flex items-center gap-1.5 text-xs",
        playing
            ? "palette-green text-palette-accent"
            : "text-palette-accent/85",
    );

/** The live dot pulses while playing, unless the reader asked for less motion. */
export const feedDot = (playing: boolean) =>
    cn(
        "size-2 rounded-full",
        playing
            ? "palette-green bg-palette-base motion-safe:animate-pulse"
            : "bg-palette-line",
    );

export const account = "flex items-baseline gap-2 text-xs tabular-nums";

export const clock = "text-palette-accent/85";

export const accountTerm = "hidden text-palette-accent/85 sm:inline";

export const accountPnl = (tone: Tone) =>
    cn("text-sm font-semibold", toned(tone));

// ─── layout (index.tsx) ───

/** The root needs a size; the gutter goes on this wrapper (padding on the root would not move
 * its row, which is `position: absolute; inset: 0`). */
export const frame = "flex min-h-0 flex-1 flex-col p-(--dk-gap)";

export const root =
    "palette-surface min-h-0 flex-1 bg-palette-base font-(family-name:--dk-font) text-palette-contrast";

/** A popout window's floor: the same as the root's. */
export const popout = root;

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

// ─── border (tabs.tsx) ───

export const border = cn(
    "palette-surface shrink-0 bg-palette-base text-palette-contrast",
    "data-[orientation=vertical]:w-10 data-[orientation=horizontal]:h-(--dk-tab-height)",
    "data-[location=start]:border-e data-[location=end]:border-s data-[location=top]:border-b data-[location=bottom]:border-t border-palette-line",
    "data-drop-target:bg-palette-soft",
);

export const borderTabList =
    "flex min-h-0 min-w-0 flex-1 items-stretch gap-(--dk-tab-gap) ps-(--dk-strip-padding) data-[orientation=vertical]:flex-col";

/** An overlay border paints over the layout: a stacking order, a shadow and a line. */
export const borderContent = cn(
    "data-overlay:z-30 data-overlay:shadow-xl data-overlay:border-palette-line",
    "data-overlay:data-[location=bottom]:border-t",
);

// ─── splitter (tabs.tsx) ───

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

// ─── tabsets and tabs (tabs.tsx) ───

export const tabset =
    "palette-raised rounded-(--dk-radius) border-(length:--dk-border) border-palette-line bg-palette-base text-palette-contrast shadow-(--dk-shadow) data-active:border-(--dk-tabset-active-line) data-maximized:shadow-none";

export const strip =
    "flex min-h-(--dk-tab-height) items-stretch border-b border-palette-line";

export const tabList =
    "flex min-w-0 flex-1 items-end gap-(--dk-tab-gap) overflow-hidden bg-(--dk-strip-bg) ps-(--dk-strip-padding) pt-[calc(var(--dk-strip-padding)/2)]";

export const tab = cn(
    "group/tab relative flex h-(--dk-tab-height) max-w-48 shrink-0 cursor-pointer select-none items-center gap-1.5 px-3",
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

export const srOnly = "sr-only";

/** The positions tab's badge: the sign of the open P&L, in its tone. */
export const pnlBadge = (tone: "up" | "down") =>
    cn(
        tonePalette[tone],
        "grid h-4 min-w-4 place-items-center rounded-full bg-palette-base px-1 font-sans text-[10px] font-bold text-palette-contrast",
    );

/** The news tab's unread headlines. */
export const unreadBadge =
    "palette-blue grid h-4 min-w-4 place-items-center rounded-full bg-palette-base px-1 font-sans text-[10px] font-semibold text-palette-contrast tabular-nums";

/** The tabset's buttons, at the end of the strip. */
export const tabsetButtons = "flex items-center gap-0.5 pe-1";

export const iconButton = cn(
    "grid size-6 shrink-0 place-items-center self-center rounded-sm text-palette-accent/85",
    "outline-none hover:bg-palette-soft hover:text-palette-contrast focus-visible:ring-2 focus-visible:ring-palette-ring",
    "disabled:pointer-events-none disabled:opacity-40",
);

/** The popout trigger says which way it goes with `data-mode`: the icons follow it. */
export const popoutIcon = "size-3.5 in-data-[mode=dock]:hidden";

export const dockIcon = "hidden size-3.5 in-data-[mode=dock]:block";

// ─── panels (panels.tsx) ───

export const symbol = "font-semibold tracking-wide";

export const instrumentName = "truncate text-xs text-palette-accent/85";

/** A price in the direction of its last move. */
export const price = (direction: "up" | "down") =>
    cn("tabular-nums", toned(direction));

export const change = (tone: Tone) => cn("text-xs tabular-nums", toned(tone));

/** A container: a narrow watchlist drops its sparklines. */
export const watchlist = "@container flex flex-col py-1";

/** A row is a button: pressed (`aria-pressed`) for the instrument the desk follows. */
export const watchRow = cn(
    "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center @[15rem]:grid-cols-[minmax(0,1fr)_3.5rem_auto] gap-2 px-3 py-1.5 text-start text-sm",
    "outline-none hover:bg-palette-soft focus-visible:ring-2 focus-visible:ring-palette-ring focus-visible:ring-inset",
    "aria-pressed:bg-palette-soft aria-pressed:shadow-[inset_2px_0_0_var(--palette-ring)]",
);

export const watchName = "flex min-w-0 flex-col";

export const watchFigures = "flex flex-col items-end";

/** A sparkline takes its tone's palette; its line is the palette's base. */
export const sparkline = (tone: Tone) =>
    cn(
        "hidden h-6 w-14 @[15rem]:block",
        tonePalette[tone],
        "stroke-palette-base",
    );

export const sparklineLine =
    "fill-none [stroke-width:1.5] [vector-effect:non-scaling-stroke]";

export const chartPanel = "flex h-full min-h-40 flex-col gap-2 p-3";

export const chartHeader =
    "flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm";

export const chartSymbol = "text-base font-semibold tracking-wide";

export const chartPrice = (direction: "up" | "down") =>
    cn("text-lg font-semibold tabular-nums", toned(direction));

export const chartRange = "ms-auto text-xs text-palette-accent/85 tabular-nums";

/** The plot: the stretched SVG fills it, the last-price label sits over it. */
export const plot = "relative min-h-0 flex-1 pe-16";

export const plotSvg = "absolute inset-y-0 start-0 h-full w-[calc(100%-4rem)]";

export const gridLine =
    "stroke-palette-line [stroke-dasharray:2_4] [vector-effect:non-scaling-stroke]";

/** A candle in its tone: the wick and the body are the palette's base. */
export const candle = (tone: "up" | "down") =>
    cn(tonePalette[tone], "fill-palette-base stroke-palette-base");

export const wick = "[stroke-width:1] [vector-effect:non-scaling-stroke]";

export const lastLine = (direction: "up" | "down") =>
    cn(
        tonePalette[direction],
        "stroke-palette-base [stroke-dasharray:3_3] [vector-effect:non-scaling-stroke]",
    );

export const lastLabel = (direction: "up" | "down") =>
    cn(
        tonePalette[direction],
        "absolute end-0 w-15 -translate-y-1/2 rounded-sm bg-palette-base px-1 py-px text-center text-[11px] font-semibold text-palette-contrast tabular-nums",
    );

export const bookPanel = "flex h-full flex-col text-xs tabular-nums";

export const bookHeader =
    "flex items-baseline justify-between border-b border-palette-line px-3 py-1.5";

export const bookColumns = "text-palette-accent/85";

/** Asks grow upwards to the spread, bids downwards from it. */
export const bookSide = (side: "bid" | "ask") =>
    cn(
        "flex flex-1 flex-col px-1",
        side === "ask" ? "justify-end" : "justify-start",
    );

export const bookLevel = "relative grid grid-cols-3 gap-2 px-2 py-px text-end";

/** A level's depth: a bar under its figures, as wide as its share of the side. */
export const depthBar = (side: "bid" | "ask") =>
    cn(
        side === "bid" ? "palette-green" : "palette-danger",
        "absolute inset-y-0 end-0 bg-palette-base/15",
    );

export const bookPrice = (side: "bid" | "ask") =>
    cn(
        "relative text-start",
        side === "bid" ? "palette-green" : "palette-danger",
        "text-palette-accent",
    );

/** A print in the tone of the side that took the price. */
export const tradePrice = (side: "buy" | "sell") =>
    bookPrice(side === "buy" ? "bid" : "ask");

export const bookSize = "relative";

export const bookTotal = "relative text-palette-accent/85";

export const spread =
    "flex items-baseline justify-between border-y border-palette-line px-3 py-1 text-sm font-semibold";

export const spreadValue = "text-xs font-normal text-palette-accent/85";

export const tape = "flex flex-col px-1 py-1 text-xs tabular-nums";

export const tapeRow = "grid grid-cols-3 gap-2 px-2 py-px text-end";

export const tapeTime = "text-start text-palette-accent/85 tabular-nums";

export const table = "w-full text-xs tabular-nums";

export const headRow = "border-b border-palette-line text-palette-accent/85";

export const head = "px-3 py-1.5 text-end font-medium";

export const headStart = "px-3 py-1.5 text-start font-medium";

export const row = "border-b border-palette-line/60 last:border-0";

export const footRow = "border-t border-palette-line font-semibold";

export const cell = "px-3 py-1 text-end";

export const cellStart = "px-3 py-1 text-start";

export const pnlCell = (tone: Tone) =>
    cn("px-3 py-1 text-end font-semibold", toned(tone));

export const sideCell = (side: "buy" | "sell") =>
    cn("px-3 py-1 text-start uppercase", toned(side === "buy" ? "up" : "down"));

export const statusCell = (ready: boolean) =>
    cn(
        "px-3 py-1 text-end",
        ready ? "palette-orange text-palette-accent" : "text-palette-accent/85",
    );

export const news = "flex flex-col gap-1 p-2 text-xs";

export const headline =
    "grid grid-cols-[auto_auto_minmax(0,1fr)] items-baseline gap-2 px-1";

/** The symbol of a headline is a button, in the tone of the story. */
export const headlineSymbol = (tone: "up" | "down") =>
    cn(
        "rounded-sm font-semibold underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-palette-ring",
        toned(tone),
    );

export const headlineText = "text-palette-contrast";

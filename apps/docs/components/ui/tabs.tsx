"use client";
// Vendored from the Fragiola UI registry (https://ui.fragiola.com/r/tabs.json, source registry/ui/tabs.tsx). Do not edit: re-run scripts/vendor-fragiola.ts.

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import type * as React from "react";
import { cn } from "@/lib/cn";

// Tabs — a strip of triggers where one is current, with an animated
// indicator. No navigation family is created: tabs and navigation-menu
// triggers share state normalisation (the `highlighted` custom variant) but
// differ in cursor, rounding and state-specific treatments. Pagination is
// `Clickable` in a `<nav>`. The negative result is recorded in the port
// report.
//
// The active indicator uses the CSS variables the primitive exposes
// (--active-tab-left/right/top/bottom/width/height), not React measurement
// in this code. The indicator tracks on resize and under RTL automatically —
// the primitive measures the active tab's position relative to the list.
//
// Orientation (horizontal / vertical) is behaviour from the primitive
// (data-orientation). The tab label declares no typography of its own. Focus
// ring is `palette-ring`; the active state is a role (`bg-palette-soft`),
// not a colour. Keyboard: arrows, home/end, and activation mode come from
// the primitive.

function TabsRoot({
    className,
    ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
    return (
        <TabsPrimitive.Root
            data-slot="tabs"
            className={cn("flex flex-col gap-2", className as string)}
            {...props}
        />
    );
}

function TabsList({
    className,
    ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
    // The list is the relative container the indicator is positioned against.
    // `flex-row` for horizontal, `flex-col` for vertical (data-orientation).
    // The border-b on horizontal / border-e on vertical is the track the
    // indicator sits on — a role (`border-palette-line`), not a colour.
    return (
        <TabsPrimitive.List
            data-slot="tabs-list"
            className={cn(
                "relative flex w-fit items-center gap-1",
                "data-[orientation=horizontal]:flex-row data-[orientation=horizontal]:border-b data-[orientation=horizontal]:border-palette-line",
                "data-[orientation=vertical]:flex-col data-[orientation=vertical]:border-e data-[orientation=vertical]:border-palette-line",
                className as string,
            )}
            {...props}
        />
    );
}

function TabsTab({
    className,
    ...props
}: React.ComponentProps<typeof TabsPrimitive.Tab>) {
    // The trigger: no typography of its own (the consumer's text is the
    // label). `highlighted` covers :focus and [data-highlighted]. The active
    // state is `bg-palette-soft` (a role), not a colour. Focus ring is
    // `palette-ring`. The `-mb-px` on horizontal pulls the tab down to
    // overlap the list's border-b, so the active tab's background covers the
    // line — the standard tab-over-line technique.
    return (
        <TabsPrimitive.Tab
            data-slot="tabs-tab"
            className={cn(
                "relative cursor-pointer items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-palette-accent/85 outline-none select-none",
                "highlighted:bg-palette-soft highlighted:text-palette-contrast",
                "data-active:bg-palette-soft data-active:text-palette-contrast",
                "focus-visible:outline-2 focus-visible:outline-palette-ring",
                "data-disabled:pointer-events-none data-disabled:opacity-50",
                "data-[orientation=horizontal]:-mb-px data-[orientation=horizontal]:rounded-b-none",
                "data-[orientation=vertical]:-ms-px data-[orientation=vertical]:rounded-e-none",
                className as string,
            )}
            {...props}
        />
    );
}

function TabsIndicator({
    className,
    ...props
}: React.ComponentProps<typeof TabsPrimitive.Indicator>) {
    // The indicator is positioned by the primitive via CSS variables it sets
    // inline: --active-tab-left/right/top/bottom/width/height. We reference
    // them via Tailwind v4's shorthand `(--var-name)` syntax (NOT
    // `[var(--var-name)]` — that older syntax breaks tailwind-merge inside
    // cn() during SSR, which silently breaks the TabsList context). The
    // primitive handles resize + RTL. Note: the primitive discards the
    // user's `style` prop, so the variables MUST be consumed via classes.
    //
    // Horizontal: positioned by left + width, sitting at the bottom of the
    // list. Vertical: positioned by top + height, sitting at the inline-end.
    // `bg-palette-base` is the palette's colour (the active indicator).
    return (
        <TabsPrimitive.Indicator
            data-slot="tabs-indicator"
            className={cn(
                "absolute rounded-sm bg-palette-base transition-all duration-200",
                "data-[orientation=horizontal]:bottom-0 data-[orientation=horizontal]:h-0.5 data-[orientation=horizontal]:left-(--active-tab-left) data-[orientation=horizontal]:w-(--active-tab-width)",
                "data-[orientation=vertical]:inset-e-0 data-[orientation=vertical]:w-0.5 data-[orientation=vertical]:top-(--active-tab-top) data-[orientation=vertical]:h-(--active-tab-height)",
                className as string,
            )}
            {...props}
        />
    );
}

function TabsPanel({
    className,
    ...props
}: React.ComponentProps<typeof TabsPrimitive.Panel>) {
    return (
        <TabsPrimitive.Panel
            data-slot="tabs-panel"
            // Enter only: the new panel fades in and slides a hair from the
            // side the activated tab sits on (`data-activation-direction`,
            // physical, matching the indicator's travel). No ending-style
            // rule on purpose — with one, Base UI keeps the leaving panel
            // mounted for the transition and the two panels stack for a
            // frame. `data-starting-style` lives one frame, so this is a
            // transition, not a keyframe class (see families/layer.ts).
            className={cn(
                "flex flex-col gap-2 outline-none",
                "transition-[opacity,translate] duration-200 ease-out motion-reduce:transition-none",
                "data-starting-style:opacity-0",
                "data-starting-style:data-[activation-direction=left]:-translate-x-2",
                "data-starting-style:data-[activation-direction=right]:translate-x-2",
                "data-starting-style:data-[activation-direction=up]:-translate-y-2",
                "data-starting-style:data-[activation-direction=down]:translate-y-2",
                className as string,
            )}
            {...props}
        />
    );
}

export const Tabs = {
    Root: TabsRoot,
    List: TabsList,
    Tab: TabsTab,
    Indicator: TabsIndicator,
    Panel: TabsPanel,
};

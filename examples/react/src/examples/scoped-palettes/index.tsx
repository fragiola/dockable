"use client";

import {
    createModel,
    type LayoutJson,
    type ParentNode,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable";
import { useDockable, useModelState } from "@fragiola/dockable-react";
import { Palette } from "lucide-react";
import { useState } from "react";
import { DropdownMenu } from "#/components/ui/dropdown-menu";
import { cn } from "#/lib/cn";
import { Card } from "../_kit/card";
import { ChartPanel } from "../_kit/charts";
import { CustomTabSet, tabsetShape } from "../_kit/custom-tabs";
import { DockLayout, KitTab } from "../_kit/layout";
import * as styles from "../_kit/styles";

// Fragiola palettes, scoped per tabset. A palette class sets six roles (base, soft, line,
// contrast, accent, ring) as CSS variables, and every `bg-palette-*`/`text-palette-*` inside
// reads them. Each tabset keeps its palette in its `data` (through the `tabset.configure` command,
// so it is saved with the layout); the tabset's element takes the class.
//
// A coloured palette's `base` is a strong fill, so the tabset uses the pairs its roles are made
// for: `soft` behind `accent` text, and the selected tab as a `base` chip with `contrast` text.

const PALETTES = [
    { value: "palette-blue", title: "Blue" },
    { value: "palette-orange", title: "Orange" },
    { value: "palette-green", title: "Green" },
    { value: "palette-purple", title: "Purple" },
    { value: "palette-surface", title: "Surface" },
    { value: "palette-raised", title: "Raised" },
] as const;

const DEFAULT_PALETTE = "palette-raised";

// What the layout holds: each tab component's data, and the tabsets' data (their palette).
type Types = {
    tabs: { chart: { name: string }; card: { name: string } };
    tabset: { palette: string };
};

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 50,
                data: { palette: "palette-blue" },
                children: [
                    { component: "chart", data: { name: "Trend" } },
                    { component: "card", data: { name: "Notes" } },
                ],
            },
            {
                type: "row",
                weight: 50,
                children: [
                    {
                        type: "tabset",
                        data: { palette: "palette-orange" },
                        children: [
                            { component: "card", data: { name: "Alerts" } },
                        ],
                    },
                    {
                        type: "tabset",
                        children: [
                            { component: "card", data: { name: "Plain" } },
                        ],
                    },
                ],
            },
        ],
    },
};

/** A tabset's palette (a tab's parent may also be a border, which has none). */
function paletteOf(node: ParentNode<Types> | undefined): string {
    return (node?.type === "tabset" && node.data?.palette) || DEFAULT_PALETTE;
}

/** The tabset's palette picker: a Fragiola DropdownMenu with a radio group. */
function PaletteMenu({ tabset }: { tabset: TabsetNode<Types> }) {
    const { run } = useDockable<Types>();
    return (
        <DropdownMenu.Root>
            <DropdownMenu.Trigger
                aria-label="Tabset palette"
                className={styles.iconButton}
            >
                <Palette aria-hidden className="size-3.5" />
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end">
                <DropdownMenu.Group>
                    <DropdownMenu.Label>Palette</DropdownMenu.Label>
                    <DropdownMenu.RadioGroup
                        value={paletteOf(tabset)}
                        onValueChange={(palette) =>
                            run("tabset.configure", {
                                tabset: tabset.id,
                                data: { ...tabset.data, palette },
                            })
                        }
                    >
                        {PALETTES.map((palette) => (
                            <DropdownMenu.RadioItem
                                key={palette.value}
                                value={palette.value}
                                closeOnClick
                            >
                                <span
                                    aria-hidden
                                    className={cn(
                                        palette.value,
                                        "size-3 rounded-full border border-palette-line bg-palette-base",
                                    )}
                                />
                                {palette.title}
                            </DropdownMenu.RadioItem>
                        ))}
                    </DropdownMenu.RadioGroup>
                </DropdownMenu.Group>
            </DropdownMenu.Content>
        </DropdownMenu.Root>
    );
}

/**
 * The panel's content in its tabset's palette. Panels live in a layer outside their tabset
 * (gap 2), so they cannot inherit its palette: the content repeats it, read from the model. (It
 * goes on the content rather than through `panelClassName`: the kit's panel already has
 * `palette-raised`, which an added `palette-surface` cannot override, since the surface rules come
 * first in the stylesheet.)
 */
function Content({ tab }: { tab: TabOf<Types> }) {
    const palette = useModelState<Types, string>((_, model) =>
        paletteOf(model.parentOf(tab.id)),
    );
    return (
        <div
            data-palette={palette}
            className={cn(
                palette,
                tab.component === "chart" ? "h-full" : "min-h-full",
                "bg-palette-soft text-palette-accent",
            )}
        >
            {tab.component === "chart" ? (
                // the chart derives its series from the palette: redraw it when that changes
                <ChartPanel
                    key={palette}
                    kind="area"
                    seed={5}
                    className="h-full"
                />
            ) : (
                <Card tab={tab} />
            )}
        </div>
    );
}

export default function ScopedPalettes() {
    const [model] = useState(() => createModel<Types>(json));
    return (
        <DockLayout
            model={model}
            // the kit's tabset, with the palette chosen here instead of its palette-raised
            renderTabSet={(tabset, options) => (
                <CustomTabSet
                    node={tabset}
                    options={options}
                    className={cn(
                        tabsetShape,
                        paletteOf(tabset),
                        "bg-palette-soft text-palette-accent",
                    )}
                    renderTabElement={(tab) => (
                        <KitTab
                            node={tab}
                            className="data-selected:bg-palette-base data-selected:text-palette-contrast"
                        />
                    )}
                />
            )}
            renderActions={(tabset) => <PaletteMenu tabset={tabset} />}
            renderContent={(tab) => <Content tab={tab} />}
        />
    );
}

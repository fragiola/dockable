"use client";

import {
    Actions,
    type IJsonModel,
    Model,
    type TabNode,
    TabSetNode,
} from "@fragiola/dockable";
import { useDockable } from "@fragiola/dockable-react";
import { Palette } from "lucide-react";
import { useState } from "react";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/cn";
import { Card } from "../_kit/card";
import { ChartPanel } from "../_kit/charts";
import { CustomTabSet, tabsetShape } from "../_kit/custom-tabs";
import { DockLayout, KitTab } from "../_kit/layout";
import { useStageTheme } from "../_kit/stage-theme";
import * as styles from "../_kit/styles";

// Fragiola palettes, scoped per tabset. A palette class sets six roles (base, soft, line,
// contrast, accent, ring) as CSS variables, and every `bg-palette-*`/`text-palette-*` inside
// reads them. Each tabset keeps its palette in its `config` (through an action, so it is saved
// with the layout); the tabset's element takes the class.
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

const json: IJsonModel = {
    global: {},
    borders: [],
    layout: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 50,
                config: { palette: "palette-blue" },
                children: [
                    { type: "tab", name: "Trend", component: "chart" },
                    { type: "tab", name: "Notes", component: "card" },
                ],
            },
            {
                type: "row",
                weight: 50,
                children: [
                    {
                        type: "tabset",
                        config: { palette: "palette-orange" },
                        children: [
                            { type: "tab", name: "Alerts", component: "card" },
                        ],
                    },
                    {
                        type: "tabset",
                        children: [
                            { type: "tab", name: "Plain", component: "card" },
                        ],
                    },
                ],
            },
        ],
    },
};

function paletteOf(tabset: TabSetNode | undefined): string {
    return (
        (tabset?.getConfig() as { palette?: string } | undefined)?.palette ??
        DEFAULT_PALETTE
    );
}

/** The tabset's palette picker: a Fragiola DropdownMenu with a radio group. */
function PaletteMenu({ tabset }: { tabset: TabSetNode }) {
    const { engine } = useDockable();
    const [themeRef, theme] = useStageTheme();
    const config = (tabset.getConfig() ?? {}) as Record<string, unknown>;
    return (
        <DropdownMenu.Root>
            <DropdownMenu.Trigger
                ref={themeRef}
                aria-label="Tabset palette"
                className={styles.iconButton}
            >
                <Palette aria-hidden className="size-3.5" />
            </DropdownMenu.Trigger>
            <DropdownMenu.Content data-example-theme={theme} align="end">
                <DropdownMenu.Group>
                    <DropdownMenu.Label>Palette</DropdownMenu.Label>
                    <DropdownMenu.RadioGroup
                        value={paletteOf(tabset)}
                        onValueChange={(palette) =>
                            engine.doAction(
                                Actions.updateNodeAttributes(tabset.getId(), {
                                    config: { ...config, palette },
                                }),
                            )
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
function Content({ tab }: { tab: TabNode }) {
    const parent = tab.getParent();
    const palette = paletteOf(
        parent instanceof TabSetNode ? parent : undefined,
    );
    return (
        <div
            data-palette={palette}
            className={cn(
                palette,
                tab.getComponent() === "chart" ? "h-full" : "min-h-full",
                "bg-palette-soft text-palette-accent",
            )}
        >
            {tab.getComponent() === "chart" ? (
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
    const [model] = useState(() => Model.fromJson(json));
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

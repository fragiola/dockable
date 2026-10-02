"use client";

import {
    createModel,
    Dockable,
    type LayoutJson,
    type ParentNode,
    type RowNode,
    type RowSplitterProps,
    type TabOf,
    type TabsetNode,
    useDockable,
    useModelState,
} from "@fragiola/dockable-react";
import { Palette } from "lucide-react";
import { useState } from "react";
import { DropdownMenu } from "#/components/ui/dropdown-menu";
import { PanelBody } from "../_kit/card";
import { type ChartKind, ChartPanel, KpiPanel } from "../_kit/charts";
import { LogPanel } from "../_kit/data";
import * as styles from "./styles";

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

type Types = {
    tabs: {
        chart: { kind: ChartKind };
        kpi: { seed: number };
        note: { text: string };
        log: undefined;
    };
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
                    {
                        component: "chart",
                        label: "Trend",
                        data: { kind: "area" },
                    },
                    {
                        component: "note",
                        label: "Notes",
                        data: {
                            text: "Pick a palette from the tabset's menu: the tabs, this panel and its charts take its colours.",
                        },
                    },
                ],
            },
            {
                type: "row",
                weight: 50,
                children: [
                    {
                        type: "tabset",
                        data: { palette: "palette-orange" },
                        children: [{ component: "log", label: "Alerts" }],
                    },
                    {
                        type: "tabset",
                        children: [
                            {
                                component: "kpi",
                                label: "Plain",
                                data: { seed: 6 },
                            },
                        ],
                    },
                ],
            },
        ],
    },
};

export default function ScopedPalettes() {
    const [model] = useState(() => createModel<Types>(json));
    return (
        <div className={styles.frame}>
            <Dockable.Root model={model} className={styles.root}>
                <Dockable.Row<Types>
                    renderSplitter={(props) => <Splitter {...props} />}
                >
                    {renderNode}
                </Dockable.Row>
                <Dockable.Panels<Types>>
                    {(tab) => (
                        <Dockable.Panel node={tab} className={styles.panel}>
                            <Content tab={tab} />
                        </Dockable.Panel>
                    )}
                </Dockable.Panels>
                <Dockable.DropIndicator className={styles.dropIndicator} />
            </Dockable.Root>
        </div>
    );
}

/** A tabset's palette (a tab's parent may also be a border, which has none). */
function paletteOf(node: ParentNode<Types> | undefined): string {
    return (node?.type === "tabset" && node.data?.palette) || DEFAULT_PALETTE;
}

function renderNode(node: TabsetNode<Types> | RowNode<Types>) {
    if (node.type === "row") {
        return (
            <Dockable.Row
                node={node}
                renderSplitter={(props) => <Splitter {...props} />}
            >
                {renderNode}
            </Dockable.Row>
        );
    }
    return <TabSet node={node} />;
}

/** A tabset in its own palette: `soft` behind `accent` text, the selected tab a `base` chip. */
function TabSet({ node }: { node: TabsetNode<Types> }) {
    return (
        <Dockable.TabSet node={node} className={styles.tabset(paletteOf(node))}>
            <div className={styles.strip}>
                <Dockable.TabList<Types>
                    aria-label="Tabs"
                    className={styles.tabList}
                >
                    {(tab) => (
                        <Dockable.Tab node={tab} className={styles.tab}>
                            <span className={styles.tabName}>{tab.label}</span>
                            <span
                                aria-hidden="true"
                                className={styles.tabMarker}
                            />
                        </Dockable.Tab>
                    )}
                </Dockable.TabList>
                <div className={styles.toolbar}>
                    <PaletteMenu tabset={node} />
                </div>
            </div>
            <Dockable.TabSetContent />
        </Dockable.TabSet>
    );
}

/** The tabset's palette picker: a Fragiola DropdownMenu with a radio group. */
function PaletteMenu({ tabset }: { tabset: TabsetNode<Types> }) {
    const { model } = useDockable<Types>();
    return (
        <DropdownMenu.Root>
            <DropdownMenu.Trigger
                aria-label="Tabset palette"
                className={styles.button}
            >
                <Palette aria-hidden className={styles.buttonIcon} />
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end">
                <DropdownMenu.Group>
                    <DropdownMenu.Label>Palette</DropdownMenu.Label>
                    <DropdownMenu.RadioGroup
                        value={paletteOf(tabset)}
                        onValueChange={(palette) =>
                            model.run("tabset.configure", {
                                tabsetId: tabset.id,
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
                                    className={styles.swatch(palette.value)}
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
 * goes on the content rather than on the `Dockable.Panel`: the panel keeps `palette-raised`, which
 * an added `palette-surface` cannot override, since the surface rules come first in the
 * stylesheet.)
 */
function Content({ tab }: { tab: TabOf<Types> }) {
    const palette = useModelState<Types, string>((_, model) =>
        paletteOf(model.get("node-parent-by", { nodeId: tab.id })),
    );
    // a chart or a KPI fills the panel; text and a log grow from it
    const fill = tab.component === "chart" || tab.component === "kpi";
    return (
        <div data-palette={palette} className={styles.content(palette, fill)}>
            <Body tab={tab} palette={palette} />
        </div>
    );
}

/** A chart derives its series from the palette: it redraws when that changes (its `key`). */
function Body({ tab, palette }: { tab: TabOf<Types>; palette: string }) {
    switch (tab.component) {
        case "chart":
            return (
                <ChartPanel
                    key={palette}
                    kind={tab.data.kind}
                    seed={5}
                    className={styles.chart}
                />
            );
        case "kpi":
            return (
                <KpiPanel
                    key={palette}
                    label={tab.label}
                    seed={tab.data.seed}
                    className={styles.chart}
                />
            );
        case "note":
            return (
                <PanelBody title={tab.label}>
                    <p>{tab.data.text}</p>
                </PanelBody>
            );
        case "log":
            return <LogPanel />;
    }
}

function Splitter(props: RowSplitterProps<Types>) {
    return (
        <Dockable.Splitter
            {...props}
            aria-label="Resize"
            className={styles.splitter}
        >
            <span aria-hidden="true" className={styles.splitterGrip} />
        </Dockable.Splitter>
    );
}

"use client";

import {
    type BorderNode,
    createModel,
    type LayoutJson,
    type RowNode,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable";
import { Dockable, type SplitterProps } from "@fragiola/dockable-react";
import { FileCode2, ListTree, Search, SquareTerminal } from "lucide-react";
import { useState } from "react";
import { Card, PanelBody } from "../_kit/card";
import { LogPanel } from "../_kit/data";
import * as styles from "./styles";

// Borders are part of the model (`borders` in its JSON): a strip of tabs on one side of the
// layout, whose selected tab opens a panel beside it. Dockable.Borders (the frame) places them
// around the main layout, Dockable.Border (the strip) holds a border's tabs and
// Dockable.BorderContent (the panel area and its splitter) is where its panel opens; open one,
// resize it, or drag a tab between a border and the tabsets.

// Every component carries its tab's name in its data.
type Named = { name: string };
type Types = {
    tabs: {
        explorer: Named;
        search: Named;
        terminal: Named;
        outline: Named;
        card: Named;
    };
};

const json: LayoutJson<Types> = {
    version: 1,
    // every border's panel size, unless the border sets its own
    defaults: { border: { size: 220 } },
    borders: [
        {
            location: "left",
            selected: 0,
            children: [
                { component: "explorer", data: { name: "Explorer" } },
                { component: "search", data: { name: "Search" } },
            ],
        },
        {
            location: "bottom",
            size: 160,
            children: [
                { component: "terminal", data: { name: "Terminal" } },
                { component: "terminal", data: { name: "Output" } },
            ],
        },
        {
            location: "right",
            children: [{ component: "outline", data: { name: "Outline" } }],
        },
    ],
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                children: [
                    { component: "card", data: { name: "app.ts" } },
                    { component: "card", data: { name: "store.ts" } },
                ],
            },
        ],
    },
};

const FILES = ["src/app.ts", "src/store.ts", "src/theme.css", "README.md"];

// an icon per border component (the editors have none)
const icons: Partial<Record<TabOf<Types>["component"], typeof ListTree>> = {
    explorer: ListTree,
    search: Search,
    terminal: SquareTerminal,
    outline: FileCode2,
};

export default function Borders() {
    const [model] = useState(() => createModel<Types>(json));
    return (
        // The root needs a size: the wrapper gives it one, and the gutter around it.
        <div className={styles.frame}>
            <Dockable.Root model={model} className={styles.root}>
                {/* The model's borders around the main layout: each one's strip, and the area
                    where its selected tab's panel opens. */}
                <Dockable.Borders<Types>
                    renderBar={(border) => <Border node={border} />}
                    renderContent={(border) => <BorderContent node={border} />}
                >
                    <Dockable.Row<Types>
                        renderSplitter={(props) => <Splitter {...props} />}
                    >
                        {renderNode}
                    </Dockable.Row>
                </Dockable.Borders>
                {/* Every tab's content, the borders' too, positioned by the engine. */}
                <Dockable.Panels<Types>>
                    {(tab) => (
                        <Dockable.Panel node={tab} className={styles.panel}>
                            <Content tab={tab} />
                        </Dockable.Panel>
                    )}
                </Dockable.Panels>
                {/* Where a dragged tab would land, animated at the layout's drag speed. */}
                <Dockable.DropIndicator
                    className={styles.dropIndicator}
                    style={(state) => ({
                        transitionDuration: `${state.tabDragSpeed}s`,
                    })}
                />
            </Dockable.Root>
        </div>
    );
}

/** A row's child: a tabset, or a nested row rendered by this same function. */
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

/** A tabset: a card with the strip of tabs on top and the measured content area below. */
function TabSet({ node }: { node: TabsetNode<Types> }) {
    return (
        <Dockable.TabSet node={node} className={styles.tabset}>
            <div className={styles.strip}>
                <Dockable.TabList<Types>
                    aria-label="Tabs"
                    className={styles.tabList}
                >
                    {(tab) => (
                        <Dockable.Tab node={tab} className={styles.tab}>
                            <span className={styles.tabName}>
                                {tab.data.name}
                            </span>
                            {/* the active tabset's marker */}
                            <span
                                aria-hidden="true"
                                className={styles.tabMarker}
                            />
                        </Dockable.Tab>
                    )}
                </Dockable.TabList>
            </div>
            <Dockable.TabSetContent />
        </Dockable.TabSet>
    );
}

/** A border's strip, with its tabs: a column on a side border. */
function Border({ node }: { node: BorderNode<Types> }) {
    return (
        <Dockable.Border node={node} className={styles.border}>
            <Dockable.TabList<Types>
                aria-label={`${node.location} panels`}
                className={styles.borderTabList}
            >
                {(tab) => (
                    <Dockable.Tab node={tab} className={styles.borderTab}>
                        <BorderTabLabel tab={tab} />
                    </Dockable.Tab>
                )}
            </Dockable.TabList>
        </Dockable.Border>
    );
}

/** Where a border's panel opens, with a splitter on the layout's side of it to resize it. */
function BorderContent({ node }: { node: BorderNode<Types> }) {
    return (
        <Dockable.BorderContent
            node={node}
            renderSplitter={(border) => <Splitter node={border} />}
        />
    );
}

function BorderTabLabel({ tab }: { tab: TabOf<Types> }) {
    const Icon = icons[tab.component];
    return (
        <>
            {Icon ? (
                <Icon aria-hidden="true" className={styles.borderTabIcon} />
            ) : null}
            {tab.data.name}
        </>
    );
}

function Content({ tab }: { tab: TabOf<Types> }) {
    switch (tab.component) {
        case "explorer":
            return (
                <PanelBody title="Explorer">
                    <ul className={styles.files}>
                        {FILES.map((file) => (
                            <li key={file} className={styles.file}>
                                {file}
                            </li>
                        ))}
                    </ul>
                </PanelBody>
            );
        case "search":
            return (
                <PanelBody title="Search">
                    <input
                        aria-label="Search files"
                        placeholder="Search"
                        className={styles.searchInput}
                    />
                </PanelBody>
            );
        case "terminal":
            return <LogPanel />;
        case "outline":
            return (
                <PanelBody title="Outline">
                    <p className={styles.outline}>createApp · render · mount</p>
                </PanelBody>
            );
        case "card":
            return <Card name={tab.data.name} />;
    }
}

/**
 * The bar between two children of a row, or beside a border's panel, with a grip for the themes
 * that show one.
 */
function Splitter(props: SplitterProps<Types>) {
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

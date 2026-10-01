"use client";

import {
    type BorderNode,
    type ComponentOf,
    createModel,
    type LayoutJson,
    type RowNode,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable";
import { Dockable, type SplitterProps } from "@fragiola/dockable-react";
import {
    Bell,
    Bookmark,
    FileText,
    ListTree,
    type LucideIcon,
    Search,
} from "lucide-react";
import { useState } from "react";
import { Card } from "../_kit/card";
import * as styles from "./styles";

// A side border's tabs read vertically here by default (writing-mode, and half a turn more on a
// left border that reads "up"; see `Border` below). Nothing in the package imposes it:
// Dockable.Border only lays its tab list out as a column, and exposes `data-orientation` and
// `data-tab-direction` for your CSS. The toggle below swaps class names, nothing else.

// What the layout holds: each tab component and the type of its data.
type Types = {
    tabs: {
        outline: { name: string };
        search: { name: string };
        bookmarks: { name: string };
        notes: { name: string };
        alerts: { name: string };
        card: { name: string };
    };
};

const json: LayoutJson<Types> = {
    version: 1,
    defaults: { border: { size: 220 } },
    borders: [
        {
            location: "left",
            selected: 0,
            children: [
                { component: "outline", data: { name: "Outline" } },
                { component: "search", data: { name: "Search" } },
                { component: "bookmarks", data: { name: "Bookmarks" } },
            ],
        },
        {
            location: "right",
            children: [
                { component: "notes", data: { name: "Notes" } },
                { component: "alerts", data: { name: "Alerts" } },
            ],
        },
    ],
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                children: [{ component: "card", data: { name: "Document" } }],
            },
        ],
    },
};

// the side panels' icons, by component (the document tab has none)
const icons: { [K in ComponentOf<Types>]?: LucideIcon } = {
    outline: ListTree,
    search: Search,
    bookmarks: Bookmark,
    notes: FileText,
    alerts: Bell,
};

type Orientation = "vertical" | "horizontal";

export default function BorderTabOrientation() {
    const [model] = useState(() => createModel<Types>(json));
    const [orientation, setOrientation] = useState<Orientation>("vertical");
    return (
        <div className={styles.page}>
            <div className={styles.toolbar}>
                <fieldset className={styles.toggleGroup}>
                    <legend className={styles.legend}>
                        Side border labels
                    </legend>
                    {(["vertical", "horizontal"] as const).map((value) => (
                        <button
                            key={value}
                            type="button"
                            data-testid={`labels-${value}`}
                            aria-pressed={orientation === value}
                            className={styles.toggle}
                            onClick={() => setOrientation(value)}
                        >
                            {value === "vertical"
                                ? "Vertical labels"
                                : "Horizontal labels"}
                        </button>
                    ))}
                </fieldset>
            </div>
            <div className={styles.frame}>
                <Dockable.Root model={model} className={styles.root}>
                    {/* The model's borders around the main layout: each one's strip, and the
                        area where its selected tab's panel opens. */}
                    <Dockable.Borders<Types>
                        renderBar={(border) => (
                            <Border node={border} orientation={orientation} />
                        )}
                        renderContent={(border) => (
                            <BorderContent node={border} />
                        )}
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
                                <Card name={tab.data.name} />
                            </Dockable.Panel>
                        )}
                    </Dockable.Panels>
                    {/* Where a dragged tab would land. */}
                    <Dockable.DropIndicator
                        className={styles.dropIndicator}
                        style={(state) => ({
                            transitionDuration: `${state.tabDragSpeed}s`,
                        })}
                    />
                </Dockable.Root>
            </div>
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

/**
 * A border's strip and its tabs. `data-orientation` is the direction its tabs run, `data-location`
 * the side it is on. The orientation toggle changes only their classes (`styles.border`,
 * `styles.borderTab`).
 */
function Border({
    node,
    orientation,
}: {
    node: BorderNode<Types>;
    orientation: Orientation;
}) {
    const upright = orientation === "horizontal";
    return (
        <Dockable.Border node={node} className={styles.border(upright)}>
            <Dockable.TabList<Types>
                aria-label={`${node.location} panels`}
                className={styles.borderTabList}
            >
                {(tab) => (
                    <Dockable.Tab
                        node={tab}
                        className={styles.borderTab(upright)}
                    >
                        <Label tab={tab} />
                    </Dockable.Tab>
                )}
            </Dockable.TabList>
        </Dockable.Border>
    );
}

function Label({ tab }: { tab: TabOf<Types> }) {
    const Icon = icons[tab.component];
    return (
        <>
            {Icon ? (
                <Icon aria-hidden="true" className={styles.labelIcon} />
            ) : null}
            {tab.data.name}
        </>
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

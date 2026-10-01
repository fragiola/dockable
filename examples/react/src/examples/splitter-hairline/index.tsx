"use client";

import {
    createModel,
    type LayoutJson,
    type RowNode,
    type TabsetNode,
} from "@fragiola/dockable";
import { Dockable, type RowSplitterProps } from "@fragiola/dockable-react";
import { useState } from "react";
import { Card } from "../_kit/card";
import * as styles from "./styles";

type Types = { tabs: { card: { name: string } } };

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 25,
                children: [{ component: "card", data: { name: "Explorer" } }],
            },
            {
                type: "row",
                weight: 75,
                children: [
                    {
                        type: "tabset",
                        weight: 70,
                        children: [
                            { component: "card", data: { name: "main.ts" } },
                            { component: "card", data: { name: "utils.ts" } },
                        ],
                    },
                    {
                        type: "tabset",
                        weight: 30,
                        children: [
                            { component: "card", data: { name: "Terminal" } },
                        ],
                    },
                ],
            },
        ],
    },
};

export default function SplitterHairline() {
    const [model] = useState(() => createModel<Types>(json));
    return (
        <div className={styles.frame}>
            <Dockable.Root model={model} className={styles.root}>
                {/* every splitter of every row is the HairlineSplitter below */}
                <Dockable.Row<Types>
                    renderSplitter={(props) => <HairlineSplitter {...props} />}
                >
                    {renderNode}
                </Dockable.Row>
                <Dockable.Panels<Types>>
                    {(tab) => (
                        <Dockable.Panel node={tab} className={styles.panel}>
                            <Card name={tab.data.name} />
                        </Dockable.Panel>
                    )}
                </Dockable.Panels>
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
                renderSplitter={(props) => <HairlineSplitter {...props} />}
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
 * The splitter, VS Code style: a 1px line (what the engine measures for the split maths) with a
 * 7px grab area that fills only while dragging or on keyboard focus. `data-orientation` is the
 * ARIA one: "vertical" is a bar between side-by-side panes.
 */
function HairlineSplitter(props: RowSplitterProps<Types>) {
    return (
        <Dockable.Splitter
            {...props}
            aria-label="Resize"
            className={styles.splitter}
        />
    );
}

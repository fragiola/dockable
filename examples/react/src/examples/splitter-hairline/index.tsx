"use client";

import {
    createModel,
    type LayoutJson,
    type RowNode,
    type TabsetNode,
} from "@fragiola/dockable";
import { Dockable, type RowSplitterProps } from "@fragiola/dockable-react";
import { useState } from "react";
import { PanelBody } from "../_kit/card";
import { LogPanel } from "../_kit/data";
import * as styles from "./styles";

// An editor's panes: a file tree, two source files and a terminal.
type Types = {
    tabs: {
        files: { name: string; files: string[] };
        source: { name: string; code: string };
        terminal: { name: string };
    };
};

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 25,
                children: [
                    {
                        component: "files",
                        data: {
                            name: "Explorer",
                            files: [
                                "src/main.ts",
                                "src/utils.ts",
                                "src/styles.css",
                                "package.json",
                                "tsconfig.json",
                            ],
                        },
                    },
                ],
            },
            {
                type: "row",
                weight: 75,
                children: [
                    {
                        type: "tabset",
                        weight: 70,
                        children: [
                            {
                                component: "source",
                                data: {
                                    name: "main.ts",
                                    code: [
                                        'import { formatTotal } from "./utils";',
                                        "",
                                        "const orders = await fetchOrders();",
                                        "console.log(formatTotal(orders));",
                                    ].join("\n"),
                                },
                            },
                            {
                                component: "source",
                                data: {
                                    name: "utils.ts",
                                    code: [
                                        "export function formatTotal(orders: Order[]) {",
                                        "    const total = orders.reduce((sum, o) => sum + o.amount, 0);",
                                        '    return "$" + total.toFixed(2);',
                                        "}",
                                    ].join("\n"),
                                },
                            },
                        ],
                    },
                    {
                        type: "tabset",
                        weight: 30,
                        children: [
                            {
                                component: "terminal",
                                data: { name: "Terminal" },
                            },
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
                            {tab.component === "files" ? (
                                <PanelBody title={tab.data.name}>
                                    <ul className={styles.fileList}>
                                        {tab.data.files.map((file) => (
                                            <li key={file}>{file}</li>
                                        ))}
                                    </ul>
                                </PanelBody>
                            ) : tab.component === "source" ? (
                                <pre className={styles.code}>
                                    {tab.data.code}
                                </pre>
                            ) : (
                                <LogPanel />
                            )}
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

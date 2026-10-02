"use client";

import {
    createModel,
    type LayoutJson,
    type RowNode,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable";
import { Dockable, type RowSplitterProps } from "@fragiola/dockable-react";
import { useState } from "react";
import { PanelBody } from "../_kit/card";
import { KpiPanel } from "../_kit/charts";
import * as styles from "./styles";

// A writing app's panes: the library's word count, the draft, its outline and the comments.
type Types = {
    tabs: {
        stats: { caption: string; seed: number };
        draft: { paragraphs: string[] };
        outline: { headings: string[] };
        comments: { comments: { author: string; text: string }[] };
    };
};

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 35,
                children: [
                    {
                        component: "stats",
                        label: "Library",
                        data: { caption: "Words written", seed: 13 },
                    },
                ],
            },
            {
                type: "row",
                weight: 65,
                children: [
                    {
                        type: "tabset",
                        weight: 60,
                        children: [
                            {
                                component: "draft",
                                label: "Draft",
                                data: {
                                    paragraphs: [
                                        "The harbour was quiet the morning the ferry did not come. Nobody said so at first; the gulls said it for them.",
                                        "By noon the café had run out of bread, and the conversation had moved from the weather to the mainland, and from the mainland to whoever had last seen the captain.",
                                    ],
                                },
                            },
                            {
                                component: "outline",
                                label: "Outline",
                                data: {
                                    headings: [
                                        "The missing ferry",
                                        "The café at noon",
                                        "The captain's house",
                                        "Night crossing",
                                    ],
                                },
                            },
                        ],
                    },
                    {
                        type: "tabset",
                        weight: 40,
                        children: [
                            {
                                component: "comments",
                                label: "Comments",
                                data: {
                                    comments: [
                                        {
                                            author: "Ada",
                                            text: "Lovely opening line.",
                                        },
                                        {
                                            author: "Grace",
                                            text: "Name the café?",
                                        },
                                        {
                                            author: "Alan",
                                            text: "The second paragraph could be split in two.",
                                        },
                                    ],
                                },
                            },
                        ],
                    },
                ],
            },
        ],
    },
};

export default function SplitterWide() {
    const [model] = useState(() => createModel<Types>(json));
    return (
        <div className={styles.frame}>
            <Dockable.Root model={model} className={styles.root}>
                {/* every splitter of every row is the WideSplitter below */}
                <Dockable.Row<Types>
                    renderSplitter={(props) => <WideSplitter {...props} />}
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

function Content({ tab }: { tab: TabOf<Types> }) {
    switch (tab.component) {
        case "stats":
            return <KpiPanel label={tab.data.caption} seed={tab.data.seed} />;
        case "draft":
            return (
                <PanelBody title={tab.label}>
                    {tab.data.paragraphs.map((paragraph) => (
                        <p key={paragraph} className={styles.paragraph}>
                            {paragraph}
                        </p>
                    ))}
                </PanelBody>
            );
        case "outline":
            return (
                <PanelBody title={tab.label}>
                    <ol className={styles.outline}>
                        {tab.data.headings.map((heading) => (
                            <li key={heading}>{heading}</li>
                        ))}
                    </ol>
                </PanelBody>
            );
        case "comments":
            return (
                <PanelBody title={tab.label}>
                    <ul className={styles.comments}>
                        {tab.data.comments.map((comment) => (
                            <li key={comment.text}>
                                <span className={styles.commentAuthor}>
                                    {comment.author}
                                </span>{" "}
                                {comment.text}
                            </li>
                        ))}
                    </ul>
                </PanelBody>
            );
    }
}

function renderNode(node: TabsetNode<Types> | RowNode<Types>) {
    if (node.type === "row") {
        return (
            <Dockable.Row
                node={node}
                renderSplitter={(props) => <WideSplitter {...props} />}
            >
                {renderNode}
            </Dockable.Row>
        );
    }
    return <TabSet node={node} />;
}

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
                            <span className={styles.tabName}>{tab.label}</span>
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
 * A wide splitter: the element is 12px thick, and the engine measures it, so the panes leave that
 * much room between them and the whole bar is a grab area. `render` hands over the separator's
 * props, `aria-valuetext` included: while you drag or focus it, a bubble shows where the splitter
 * sits in its row.
 */
function WideSplitter(props: RowSplitterProps<Types>) {
    return (
        <Dockable.Splitter
            {...props}
            aria-label="Resize"
            className={styles.splitter}
            render={(separator) => (
                <div {...separator}>
                    <span
                        aria-hidden="true"
                        data-testid="splitter-readout"
                        className={styles.splitterReadout}
                    >
                        {separator["aria-valuetext"]}
                    </span>
                </div>
            )}
        />
    );
}

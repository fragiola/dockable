"use client";

import {
    createModel,
    getSplitterPath,
    type LayoutJson,
    type RowNode,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable";
import {
    Dockable,
    type RowSplitterProps,
    useDockable,
    useSplitter,
} from "@fragiola/dockable-react";
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

/** A tab's content, by component: the data carries what it shows. */
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

/** A row's child: a tabset, or a nested row rendered by this same function. */
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
                            <span className={styles.tabName}>{tab.label}</span>
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
 * A wide splitter: the element is 12px thick, and the engine measures it, so the panes leave that
 * much room between them and the whole bar is a grab area. It is built on the lower layer,
 * `useSplitter`, instead of `Dockable.Splitter`: the hook gives its state (`dragging`,
 * `orientation`) and the props of the separator element (the ref, `role`, the ARIA values, the
 * pointer and keyboard handlers, and the structural style that hides it while a tabset is
 * maximized). While you drag or focus it, a bubble shows `aria-valuetext`: where the splitter sits
 * in its row.
 */
function WideSplitter({ node, index }: RowSplitterProps<Types>) {
    const { state, props } = useSplitter(node, index);
    // the path (`/r0/s0`) comes from the row's own, which the engine knows by id
    const { engine } = useDockable<Types>();
    // the separator's orientation: "vertical" is a bar between side-by-side panes
    const vertical = state.orientation === "vertical";
    return (
        // biome-ignore lint/a11y/useSemanticElements: a focusable separator widget with a grip; an <hr> cannot hold children
        // biome-ignore lint/a11y/useFocusableInteractive: tabIndex={0} comes in props
        <div
            {...props}
            // biome-ignore lint/a11y/useAriaPropsForRole: aria-valuenow and the rest come in props
            role="separator"
            // a splitter has no name of its own: the app gives it one
            aria-label="Resize"
            data-layout-path={getSplitterPath(
                engine.get("layout-path-by", { nodeId: node.id }),
                index,
            )}
            data-orientation={state.orientation}
            data-dragging={state.dragging ? "" : undefined}
            className={styles.splitter(vertical)}
        >
            <span
                aria-hidden="true"
                data-testid="splitter-readout"
                className={styles.splitterReadout}
            >
                {props["aria-valuetext"]}
            </span>
        </div>
    );
}

"use client";

import {
    createModel,
    getSplitterPath,
    type LayoutJson,
    type RowNode,
    type TabsetNode,
} from "@fragiola/dockable";
import {
    Dockable,
    type RowSplitterProps,
    useDockable,
    useSplitter,
} from "@fragiola/dockable-react";
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
                weight: 35,
                children: [{ component: "card", data: { name: "Library" } }],
            },
            {
                type: "row",
                weight: 65,
                children: [
                    {
                        type: "tabset",
                        weight: 60,
                        children: [
                            { component: "card", data: { name: "Draft" } },
                            { component: "card", data: { name: "Outline" } },
                        ],
                    },
                    {
                        type: "tabset",
                        weight: 40,
                        children: [
                            { component: "card", data: { name: "Comments" } },
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
 * A splitter built on the lower layer, `useSplitter`, instead of `Dockable.Splitter`: the hook
 * gives its state (`dragging`, `orientation`) and the props of the separator element (the ref,
 * `role`, the ARIA values, the pointer and keyboard handlers, and the structural style that hides
 * it while a tabset is maximized). The element is 12px thick (the engine measures it); a grip of
 * three dots sits in the middle, and while you drag or focus it a bubble shows `aria-valuetext`:
 * where the splitter sits in its row.
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
            {[0, 1, 2].map((dot) => (
                <span
                    key={dot}
                    aria-hidden="true"
                    className={styles.splitterDot}
                />
            ))}
            <span
                aria-hidden="true"
                data-testid="splitter-readout"
                className={styles.splitterReadout(vertical)}
            >
                {props["aria-valuetext"]}
            </span>
        </div>
    );
}

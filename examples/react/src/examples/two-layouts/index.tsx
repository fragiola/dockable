"use client";

import {
    createModel,
    Dockable,
    type LayoutJson,
    type Model,
    type RowNode,
    type RowSplitterProps,
    type TabsetNode,
} from "@fragiola/dockable-react";
import { useState } from "react";
import { Card } from "../_kit/card";
import * as styles from "./styles";

// Two layouts with their own models, in one Dockable.DragGroup: drag a tab from one into the
// other. Each model's middleware sees its side (a `tab.add` in the target, a `tab.close` in the
// source, both marked `meta.transfer`), and either can refuse. The tab's content moves with it.

// What both layouts hold: one tab component, named by its label. A transferred tab keeps its label,
// component and data, so the two models share the registry.
type Types = { tabs: { card: undefined } };

const card = (name: string) => ({ component: "card" as const, label: name });

const workspace: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                children: [card("Report"), card("Chart"), card("Data")],
            },
        ],
    },
};

const scratch: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [{ type: "tabset", children: [card("Ideas")] }],
    },
};

export default function TwoLayouts() {
    const [workspaceModel] = useState(() => createModel<Types>(workspace));
    const [scratchModel] = useState(() => createModel<Types>(scratch));
    return (
        // one drag group around both roots: a tab dragged out of one can drop into the other
        <Dockable.DragGroup>
            <div className={styles.panes}>
                <Pane title="Workspace" model={workspaceModel} />
                <Pane title="Scratch" model={scratchModel} />
            </div>
        </Dockable.DragGroup>
    );
}

/** One of the two layouts, with its own model. */
function Pane({ title, model }: { title: string; model: Model<Types> }) {
    return (
        <section
            aria-label={title}
            data-testid={`pane-${title.toLowerCase()}`}
            className={styles.pane}
        >
            <h2 className={styles.paneTitle}>{title}</h2>
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
                                <Card name={tab.label} />
                            </Dockable.Panel>
                        )}
                    </Dockable.Panels>
                    <Dockable.DropIndicator className={styles.dropIndicator} />
                </Dockable.Root>
            </div>
        </section>
    );
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
                        </Dockable.Tab>
                    )}
                </Dockable.TabList>
            </div>
            <Dockable.TabSetContent />
        </Dockable.TabSet>
    );
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

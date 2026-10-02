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
import { CommandConsole } from "./console";
import * as styles from "./styles";

// The layout as data an assistant can drive: every change is a named command with a JSON Schema,
// so a script, a test, a chat assistant or this console can run it by name plus JSON. The console
// beside the layout lists the commands (`model.get("commands")`), runs one typed as JSON
// (`model.dispatch`), shows its result or its structured error, and logs every change
// (`model.subscribe`).

type Types = { tabs: { note: { text: string } } };

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                id: "left",
                weight: 55,
                children: [
                    {
                        id: "readme",
                        component: "note",
                        label: "Readme",
                        data: {
                            text: "Run a command from the console: select, move or add a tab.",
                        },
                    },
                    {
                        id: "todo",
                        component: "note",
                        label: "Todo",
                        data: {
                            text: "Every change the console makes goes through the same bus as a drag.",
                        },
                    },
                ],
            },
            {
                type: "tabset",
                id: "right",
                weight: 45,
                children: [
                    {
                        id: "ideas",
                        component: "note",
                        label: "Ideas",
                        data: {
                            text: "Hand the commands to an assistant as tools.",
                        },
                    },
                ],
            },
        ],
    },
};

export default function CommandConsoleExample() {
    const [model] = useState(() => createModel<Types>(json));
    return (
        <div className={styles.page}>
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
                                <PanelBody title={tab.label}>
                                    <p className={styles.panelText}>
                                        {tab.data.text}
                                    </p>
                                    <p className={styles.panelId}>
                                        {`id: ${tab.id}`}
                                    </p>
                                </PanelBody>
                            </Dockable.Panel>
                        )}
                    </Dockable.Panels>
                    <Dockable.DropIndicator className={styles.dropIndicator} />
                </Dockable.Root>
            </div>
            {/* outside the root: the console talks to the model only */}
            <CommandConsole model={model} />
        </div>
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

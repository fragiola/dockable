"use client";

import {
    createModel,
    Dockable,
    type LayoutJson,
    type RowNode,
    type RowSplitterProps,
    type TabsetNode,
    useDockable,
} from "@fragiola/dockable-react";
import { Plus } from "lucide-react";
import { useState } from "react";
import { DropdownMenu } from "#/components/ui/dropdown-menu";
import { type Kind, renderFactory, TEMPLATES, type Types } from "./factory";
import * as styles from "./styles";

// Tabs whose `component` field selects their content (see factory.tsx). Content renders on
// demand (`renderOnDemand` on `Dockable.Panels`, on by default): a tab's content mounts the first
// time it is shown and then stays mounted.

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 55,
                children: [
                    { ...TEMPLATES.chart, label: "Revenue" },
                    TEMPLATES.table,
                    {
                        component: "table",
                        label: "Pending",
                        data: { status: "Pending" },
                    },
                ],
            },
            {
                type: "tabset",
                weight: 45,
                children: [
                    {
                        component: "markdown",
                        label: "README.md",
                        data: {
                            text: "# Component factory\nEach tab names a component and carries its data.\n- chart, table, markdown, form\n- add more with the + menu",
                        },
                    },
                    TEMPLATES.form,
                ],
            },
        ],
    },
};

const KINDS: { kind: Kind; title: string }[] = [
    { kind: "chart", title: "Chart" },
    { kind: "table", title: "Table" },
    { kind: "markdown", title: "Markdown" },
    { kind: "form", title: "Form" },
];

export default function ComponentFactory() {
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
                            {renderFactory(tab)}
                        </Dockable.Panel>
                    )}
                </Dockable.Panels>
                <Dockable.DropIndicator className={styles.dropIndicator} />
            </Dockable.Root>
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

/** A tabset: its strip of tabs with the Add menu at the end, and the measured content area. */
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
                <div className={styles.tabsetButtons}>
                    <AddMenu tabset={node} />
                </div>
            </div>
            <Dockable.TabSetContent />
        </Dockable.TabSet>
    );
}

/** The "Add" menu of a tabset: a new tab of any kind, with its own data. */
function AddMenu({ tabset }: { tabset: TabsetNode<Types> }) {
    const { model } = useDockable<Types>();
    return (
        <DropdownMenu.Root>
            <DropdownMenu.Trigger
                aria-label="Add a tab"
                className={styles.iconButton}
            >
                <Plus aria-hidden className={styles.iconButtonIcon} />
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end">
                {KINDS.map(({ kind, title }) => (
                    <DropdownMenu.Item
                        key={kind}
                        onClick={() =>
                            model.run("tab.add", {
                                ...TEMPLATES[kind],
                                to: tabset.id,
                                select: true, // select it: its content mounts now
                            })
                        }
                    >
                        {title}
                    </DropdownMenu.Item>
                ))}
            </DropdownMenu.Content>
        </DropdownMenu.Root>
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

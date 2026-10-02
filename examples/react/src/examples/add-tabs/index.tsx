"use client";

import {
    createModel,
    type LayoutJson,
    MAIN_LAYOUT,
    type RowNode,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable";
import { Dockable, type RowSplitterProps } from "@fragiola/dockable-react";
import { ChartLine, ScrollText, Table2 } from "lucide-react";
import { useRef, useState } from "react";
import { Select } from "#/components/ui/select";
import { ChartPanel } from "../_kit/charts";
import { LogPanel, TablePanel } from "../_kit/data";
import * as styles from "./styles";

// What the layout holds: each tab component and the type of its data.
type Types = {
    tabs: {
        chart: undefined;
        table: undefined;
        log: undefined;
    };
};

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                children: [
                    { component: "chart", label: "Revenue" },
                    { component: "table", label: "Orders" },
                ],
            },
        ],
    },
};

type Target = "active" | "right" | "bottom";

const TARGETS: { value: Target; label: string }[] = [
    { value: "active", label: "Active tabset" },
    { value: "right", label: "New tabset on the right" },
    { value: "bottom", label: "New tabset at the bottom" },
];

const KINDS = [
    { component: "chart", name: "Chart", icon: ChartLine },
    { component: "table", name: "Table", icon: Table2 },
    { component: "log", name: "Log", icon: ScrollText },
] as const;

export default function AddTabs() {
    const [model] = useState(() => createModel<Types>(json));
    const [target, setTarget] = useState<Target>("active");
    const count = useRef(0);

    // The toolbar is outside the layout: it runs commands on the model it owns, no engine needed.
    const add = (kind: (typeof KINDS)[number]) => {
        count.current += 1;
        const tab = {
            component: kind.component,
            label: `${kind.name} ${count.current}`,
        };
        if (target === "active") {
            // into the active tabset (else the first), at the end (-1), and selected; with no
            // tabset left, into the layout itself: a new tabset
            model.run("tab.add", {
                ...tab,
                to: model.get("default-tabset")?.id ?? MAIN_LAYOUT,
                location: "center",
                index: -1,
                select: true,
            });
        } else {
            // dropped on an edge of the layout (its root row): a new tabset along that edge
            model.run("tab.add", {
                ...tab,
                to: MAIN_LAYOUT,
                location: target,
                select: true,
            });
        }
    };

    return (
        <div className={styles.page}>
            <div className={styles.toolbar}>
                {KINDS.map((kind) => (
                    <button
                        key={kind.component}
                        type="button"
                        className={styles.button}
                        onClick={() => add(kind)}
                    >
                        <kind.icon aria-hidden className={styles.buttonIcon} />
                        {`New ${kind.name.toLowerCase()}`}
                    </button>
                ))}
                <span className={styles.targetLabel}>Add to</span>
                <Select.Root
                    value={target}
                    onValueChange={(value) => setTarget(value as Target)}
                    items={TARGETS}
                >
                    <Select.Trigger
                        aria-label="Where to add"
                        data-testid="target"
                        className={styles.targetSelect}
                    >
                        <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                        {TARGETS.map((item) => (
                            <Select.Item key={item.value} value={item.value}>
                                {item.label}
                            </Select.Item>
                        ))}
                    </Select.Content>
                </Select.Root>
            </div>
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
                                <Content tab={tab} />
                            </Dockable.Panel>
                        )}
                    </Dockable.Panels>
                    <Dockable.DropIndicator className={styles.dropIndicator} />
                </Dockable.Root>
            </div>
        </div>
    );
}

/** A tab's content: `tab.data` narrows on `tab.component`. */
function Content({ tab }: { tab: TabOf<Types> }) {
    switch (tab.component) {
        case "chart":
            return <ChartPanel seed={tab.label.length * 7} />;
        case "table":
            return <TablePanel />;
        case "log":
            return <LogPanel />;
    }
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

/** The bar between two children of a row, with a grip for the themes that show one. */
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

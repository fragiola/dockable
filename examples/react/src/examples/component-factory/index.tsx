"use client";

import {
    createModel,
    type LayoutJson,
    type RowNode,
    type TabsetNode,
} from "@fragiola/dockable";
import {
    Dockable,
    type RowSplitterProps,
    useDockable,
} from "@fragiola/dockable-react";
import { Plus } from "lucide-react";
import {
    type ReactNode,
    useEffect,
    useState,
    useSyncExternalStore,
} from "react";
import { DropdownMenu } from "#/components/ui/dropdown-menu";
import { type Kind, renderFactory, TEMPLATES, type Types } from "./factory";
import * as styles from "./styles";

// Tabs whose `component` field selects their content (see factory.tsx). Content renders on
// demand (`renderOnDemand` on `Dockable.Panels`, on by default): a tab's content mounts the first
// time it is shown and then stays mounted. The toolbar counts the mounted contents.

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
    const [mounted, setMounted] = useState<ReadonlySet<string>>(new Set());
    const [onMount] = useState(
        () => (id: string) =>
            setMounted((set) => (set.has(id) ? set : new Set(set).add(id))),
    );
    // this component is outside Dockable.Root: it follows the model through `subscribe`
    const total = useSyncExternalStore(
        model.subscribe,
        () => model.get("all-tabs").length,
    );
    return (
        <>
            <div className={styles.toolbar}>
                <p
                    role="status"
                    data-testid="mounted"
                    className={styles.status}
                >
                    {`Content mounted for ${mounted.size} of ${total} tabs`}
                </p>
            </div>
            {/* The root needs a size: the wrapper gives it one, and the gutter around it. */}
            <div className={styles.frame}>
                <Dockable.Root model={model} className={styles.root}>
                    <Dockable.Row<Types>
                        renderSplitter={(props) => <Splitter {...props} />}
                    >
                        {renderNode}
                    </Dockable.Row>
                    {/* `renderOnDemand` is on by default: a tab's content mounts the first time
                        it is shown */}
                    <Dockable.Panels<Types>>
                        {(tab) => (
                            <Dockable.Panel node={tab} className={styles.panel}>
                                <Mounted id={tab.id} onMount={onMount}>
                                    {renderFactory(tab)}
                                </Mounted>
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
        </>
    );
}

/** Reports once, when the content first mounts. */
function Mounted({
    id,
    onMount,
    children,
}: {
    id: string;
    onMount: (id: string) => void;
    children: ReactNode;
}) {
    useEffect(() => onMount(id), [id, onMount]);
    return children;
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
                            {/* the active tabset's marker */}
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

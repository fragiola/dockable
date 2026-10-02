"use client";

import {
    createModel,
    type LayoutJson,
    type RowNode,
    type TabNode,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable";
import {
    Dockable,
    type RowSplitterProps,
    useDockable,
} from "@fragiola/dockable-react";
import { CircleCheck, CircleX, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Badge } from "#/components/atoms/badge";
import { PanelBody } from "../_kit/card";
import * as styles from "./styles";

// The tab follows its content. The content writes what the tab needs to know into the tab's
// `data` (with a command, so it is in the model, the JSON and the undo history); the tab reads
// `tab.data`, typed by its component, and exposes it as its own `data-*` attributes for the styles.

export type Status = "healthy" | "degraded" | "down";

interface MonitorData {
    status: Status;
    incidents: number;
}

interface DocumentData {
    dirty: boolean;
}

// What the layout holds: each tab component and the type of its data.
type Types = { tabs: { monitor: MonitorData; document: DocumentData } };

const STATUS = {
    healthy: { Icon: CircleCheck, text: "Healthy" },
    degraded: { Icon: TriangleAlert, text: "Degraded" },
    down: { Icon: CircleX, text: "Down" },
} as const;

const monitor = (name: string, status: Status, incidents = 0) => ({
    component: "monitor" as const,
    label: name,
    data: { status, incidents },
});

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 55,
                children: [
                    monitor("API", "healthy"),
                    monitor("Database", "degraded", 2),
                    monitor("Queue", "healthy"),
                ],
            },
            {
                type: "tabset",
                weight: 45,
                children: [
                    {
                        component: "document",
                        label: "README.md",
                        data: { dirty: false },
                    },
                    {
                        component: "document",
                        label: "notes.txt",
                        data: { dirty: false },
                    },
                ],
            },
        ],
    },
};

export default function ContentAwareTabs() {
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
                            <Content tab={tab} />
                        </Dockable.Panel>
                    )}
                </Dockable.Panels>
                <Dockable.DropIndicator className={styles.dropIndicator} />
            </Dockable.Root>
        </div>
    );
}

/** `tab.data` narrows on `tab.component`: each panel gets its own typed tab. */
function Content({ tab }: { tab: TabOf<Types> }) {
    switch (tab.component) {
        case "monitor":
            return <Monitor tab={tab} />;
        case "document":
            return <Editor tab={tab} />;
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

/** A tabset: a card with the strip of status tabs on top and the measured content area below. */
function TabSet({ node }: { node: TabsetNode<Types> }) {
    return (
        <Dockable.TabSet node={node} className={styles.tabset}>
            <div className={styles.strip}>
                <Dockable.TabList<Types>
                    aria-label="Tabs"
                    className={styles.tabList}
                >
                    {(tab) => <StatusTab tab={tab} />}
                </Dockable.TabList>
            </div>
            <Dockable.TabSetContent />
        </Dockable.TabSet>
    );
}

/** What a tab shows about its content, read from its typed data. */
function tabState(tab: TabOf<Types>) {
    switch (tab.component) {
        case "monitor":
            return {
                status: tab.data.status,
                incidents: tab.data.incidents,
                dirty: false,
            };
        case "document":
            return { status: undefined, incidents: 0, dirty: tab.data.dirty };
    }
}

/** The tab: it only reads the data and turns it into `data-*` and a palette. */
function StatusTab({ tab }: { tab: TabOf<Types> }) {
    const { status: current, incidents, dirty } = tabState(tab);
    const status = current ? STATUS[current] : undefined;
    return (
        <Dockable.Tab
            node={tab}
            data-status={current}
            data-modified={dirty ? "" : undefined}
            className={styles.tab(current)}
        >
            {status ? (
                <status.Icon aria-hidden className={styles.tabIcon} />
            ) : null}
            <span className={styles.tabName}>{tab.label}</span>
            {/* the active tabset's marker */}
            <span aria-hidden="true" className={styles.tabMarker} />
            {incidents ? (
                <Badge
                    variant="solid"
                    aria-label={`${incidents} incidents`}
                    className={styles.tabIncidents}
                >
                    {incidents}
                </Badge>
            ) : null}
            {dirty ? (
                // the "modified" dot; its text is for screen readers only
                <span className={styles.tabModified}>
                    <span className={styles.srOnly}>Modified</span>
                </span>
            ) : null}
        </Dockable.Tab>
    );
}

/** Content that reports its status to its tab. */
function Monitor({ tab }: { tab: TabNode<"monitor", MonitorData> }) {
    const { model } = useDockable<Types>();
    const data = tab.data;
    const report = (status: Status) => {
        if (status === data.status) {
            return;
        }
        // `tab.set-data` patches the data: the keys it passes change, the others stay
        model.run("tab.set-data", {
            tabId: tab.id,
            data: {
                status,
                incidents: data.incidents + (status === "healthy" ? 0 : 1),
            },
        });
    };
    return (
        <PanelBody title={`${tab.label} service`}>
            <p className={styles.monitorText}>
                Set the service's health. The panel writes it into the tab's
                data with a command; the tab reads it back.
            </p>
            <fieldset className={styles.statusList}>
                <legend className={styles.srOnly}>Status</legend>
                {(Object.keys(STATUS) as Status[]).map((status) => (
                    <button
                        key={status}
                        type="button"
                        aria-pressed={data.status === status}
                        className={styles.statusButton(
                            status,
                            data.status === status,
                        )}
                        onClick={() => report(status)}
                    >
                        {STATUS[status].text}
                    </button>
                ))}
            </fieldset>
            <p className={styles.incidents}>
                {`Incidents so far: ${data.incidents}`}
            </p>
        </PanelBody>
    );
}

/** An editor that marks its tab as modified while its text differs from the saved one. */
function Editor({ tab }: { tab: TabNode<"document", DocumentData> }) {
    const { model } = useDockable<Types>();
    const [saved, setSaved] = useState(`# ${tab.label}\n`);
    const [text, setText] = useState(saved);
    const setDirty = (dirty: boolean) => {
        // only run the command when the flag changes, not on every keystroke
        if (tab.data.dirty !== dirty) {
            model.run("tab.set-data", { tabId: tab.id, data: { dirty } });
        }
    };
    return (
        <div className={styles.editor}>
            <textarea
                aria-label={`${tab.label} text`}
                value={text}
                onChange={(event) => {
                    setText(event.target.value);
                    setDirty(event.target.value !== saved);
                }}
                className={styles.editorText}
            />
            <div>
                <button
                    type="button"
                    className={styles.saveButton}
                    onClick={() => {
                        setSaved(text);
                        setDirty(false);
                    }}
                >
                    Save
                </button>
            </div>
        </div>
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

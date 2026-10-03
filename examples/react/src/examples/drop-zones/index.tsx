"use client";

import {
    createModel,
    Dockable,
    type DragSubject,
    type LayoutJson,
    type Model,
    type RowNode,
    type RowSplitterProps,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable-react";
import {
    ExternalLink,
    type LucideIcon,
    PanelRight,
    Trash2,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { PanelBody } from "../_kit/card";
import { ChartPanel, KpiPanel } from "../_kit/charts";
import { TablePanel } from "../_kit/data";
import * as styles from "./styles";

// Drop zones: elements outside the layout that take a dragged tab. While a drag the zone takes is
// in progress it has `data-drop-active`; while the pointer is over it, `data-drop-over` (and the
// layout hides its outline). A drop calls `onDrop` with what is dragged: nothing moves by itself,
// the zone runs the command it stands for on the model (so its middleware sees it).

type Types = {
    tabs: {
        table: undefined;
        note: { text: string };
        chart: { seed: number };
        kpi: { seed: number };
    };
};

const json: LayoutJson<Types> = {
    version: 1,
    defaults: { tab: { poppable: true } },
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 50,
                children: [
                    { component: "table", label: "Inbox" },
                    {
                        component: "note",
                        label: "Drafts",
                        data: {
                            text: "Reply to Grace about the pending order, and send Alan his invoice.",
                        },
                    },
                    // cannot be closed: the trash does not take it
                    {
                        component: "note",
                        label: "Pinned note",
                        data: {
                            text: "This tab cannot be closed: the trash does not take it.",
                        },
                        closable: false,
                    },
                ],
            },
            {
                type: "tabset",
                weight: 50,
                children: [
                    {
                        component: "chart",
                        label: "Calendar",
                        data: { seed: 11 },
                    },
                    { component: "kpi", label: "Contacts", data: { seed: 6 } },
                ],
            },
        ],
    },
};

// The popout host page, served next to the app under its base (Vite's `BASE_URL`): the Pop out
// zone opens a tab in a window.
const popoutURL = `${import.meta.env.BASE_URL}popout.html`;

export default function DropZones() {
    const [model] = useState(() => createModel<Types>(json));
    const [status, setStatus] = useState("Drag a tab onto a zone below.");

    // the zones live outside Dockable.Root: they run commands on the model itself
    const report = (ok: boolean, describe: string) => {
        if (ok) setStatus(describe);
    };

    return (
        <div className={styles.page}>
            <div className={styles.frame}>
                <Dockable.Root
                    model={model}
                    popoutURL={popoutURL}
                    // copies <html> and <body>'s attributes (light/dark, the example theme) into
                    // each popout window, kept in sync
                    popoutMirrorRoot
                    className={styles.root}
                >
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
                    {/* a popped-out tab's window: its own layout, and its own outline */}
                    <Dockable.Popout<Types> className={styles.popout}>
                        {() => (
                            <>
                                <Dockable.Row<Types>
                                    renderSplitter={(props) => (
                                        <Splitter {...props} />
                                    )}
                                >
                                    {renderNode}
                                </Dockable.Row>
                                <Dockable.DropIndicator
                                    className={styles.dropIndicator}
                                />
                            </>
                        )}
                    </Dockable.Popout>
                </Dockable.Root>
            </div>
            <div className={styles.zones}>
                <Zone
                    model={model}
                    id="close"
                    icon={Trash2}
                    label="Close"
                    tone="danger"
                    // only tabs that may be closed
                    accepts={(tab) => model.can("tab.close", { tabId: tab.id })}
                    onDrop={(tab) =>
                        report(
                            model.run("tab.close", { tabId: tab.id }).ok,
                            `Closed ${tab.label}`,
                        )
                    }
                />
                <Zone
                    model={model}
                    id="right"
                    icon={PanelRight}
                    label="Open to the right"
                    tone="blue"
                    accepts={() => true}
                    onDrop={(tab) => {
                        const root = model.get("root-row");
                        if (!root) return;
                        // the end edge of the root row (the right in LTR): a new tabset there
                        report(
                            model.run("tab.move", {
                                tabId: tab.id,
                                to: root.id,
                                location: "end",
                            }).ok,
                            `Moved ${tab.label} to the right`,
                        );
                    }}
                />
                <Zone
                    model={model}
                    id="popout"
                    icon={ExternalLink}
                    label="Pop out"
                    tone="green"
                    accepts={(tab) =>
                        model.can("tab.popout", { tabId: tab.id })
                    }
                    onDrop={(tab) =>
                        report(
                            model.run("tab.popout", { tabId: tab.id }).ok,
                            `Popped out ${tab.label}`,
                        )
                    }
                />
                <p role="status" data-testid="status" className={styles.status}>
                    {status}
                </p>
            </div>
        </div>
    );
}

/** The dragged tab of the layout, or undefined for a tabset or a new tab. */
function draggedTab(drag: DragSubject<Types>): TabOf<Types> | undefined {
    return drag.kind === "tab" ? drag.tab : undefined;
}

function Zone({
    model,
    icon: Icon,
    label,
    accepts,
    onDrop,
    tone,
    id,
}: {
    id: string;
    model: Model<Types>;
    icon: LucideIcon;
    label: ReactNode;
    accepts: (tab: TabOf<Types>) => boolean;
    onDrop: (tab: TabOf<Types>) => void;
    tone: styles.Tone;
}) {
    return (
        <Dockable.DropZone
            model={model}
            // the zones take tabs only
            accepts={(drag) => {
                const tab = draggedTab(drag);
                return tab !== undefined && accepts(tab);
            }}
            onDrop={(drag) => {
                const tab = draggedTab(drag);
                if (tab) onDrop(tab);
            }}
            data-testid={`zone-${id}`}
            className={styles.zone(tone)}
        >
            <Icon aria-hidden className={styles.zoneIcon} />
            {label}
        </Dockable.DropZone>
    );
}

function Content({ tab }: { tab: TabOf<Types> }) {
    switch (tab.component) {
        case "table":
            return <TablePanel />;
        case "note":
            return (
                <PanelBody title={tab.label}>
                    <p className={styles.panelText}>{tab.data.text}</p>
                </PanelBody>
            );
        case "chart":
            return (
                <ChartPanel kind="bar" seed={tab.data.seed} title={tab.label} />
            );
        case "kpi":
            return <KpiPanel label={tab.label} seed={tab.data.seed} />;
    }
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

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
    useTabSet,
} from "@fragiola/dockable-react";
import { useEffect, useState } from "react";
import { type ChartKind, ChartPanel, KpiPanel } from "../_kit/charts";
import * as styles from "./styles";

// The drop indicator is the app's to draw, from data. Here its colour says where a dragged tab
// would land, in two parts:
//
//   which region  each tabset has a colour family: Inbox green, Review orange, Archive purple,
//                 Trash red (a tabset made by a split is rose); the layout's edge is blue
//   which side    a drop into the tabset fills the outline, a drop beside it (an edge of the
//                 tabset) thickens the side it docks to, a drop at the layout's edge is striped
//
// The side and the kind of drop are in the indicator's state (`location`, `kind`). Which tabset is
// targeted is the tabset's own state (`useTabSet(node).state.dropTarget`, also `data-drop-target`
// on it): each tabset reports it here, and the indicator's class reads it. Workaround (E19 in
// docs/docs-examples-gaps.md): the indicator's state does not name its target tabset.

type Types = {
    tabs: {
        chart: { kind: ChartKind };
        kpi: { seed: number };
    };
};

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "row",
                weight: 50,
                children: [
                    {
                        type: "tabset",
                        id: "inbox",
                        children: [
                            {
                                component: "kpi",
                                label: "Signups",
                                data: { seed: 5 },
                            },
                            {
                                component: "chart",
                                label: "Leads",
                                data: { kind: "line" },
                            },
                        ],
                    },
                    {
                        type: "tabset",
                        id: "review",
                        children: [
                            {
                                component: "chart",
                                label: "Pipeline",
                                data: { kind: "bar" },
                            },
                        ],
                    },
                ],
            },
            {
                type: "row",
                weight: 50,
                children: [
                    {
                        type: "tabset",
                        id: "archive",
                        children: [
                            {
                                component: "chart",
                                label: "Q1 share",
                                data: { kind: "donut" },
                            },
                        ],
                    },
                    {
                        type: "tabset",
                        id: "trash",
                        children: [
                            {
                                component: "kpi",
                                label: "Churn",
                                data: { seed: 14 },
                            },
                        ],
                    },
                ],
            },
        ],
    },
};

/** The legend: what each colour and each pattern means. */
const REGIONS: { region: styles.Region; label: string }[] = [
    { region: "inbox", label: "Inbox" },
    { region: "review", label: "Review" },
    { region: "archive", label: "Archive" },
    { region: "trash", label: "Trash" },
    { region: "edge", label: "Layout edge" },
];

export default function DropIndicatorColours() {
    const [model] = useState(() => createModel<Types>(json));
    // the tabset a drag would drop into or beside, as the tabsets report it
    const [target, setTarget] = useState<string | undefined>(undefined);
    return (
        <>
            <div className={styles.legend}>
                <ul aria-label="Regions" className={styles.legendList}>
                    {REGIONS.map(({ region, label }) => (
                        <li key={region} className={styles.legendItem}>
                            <span
                                aria-hidden="true"
                                className={styles.swatch(region)}
                            />
                            {label}
                        </li>
                    ))}
                </ul>
                <p className={styles.legendHint}>
                    Filled: into the tabset. Thick side: beside it. Stripes: at
                    the layout's edge.
                </p>
            </div>
            <div className={styles.frame}>
                <Dockable.Root model={model} className={styles.root}>
                    <Dockable.Row<Types>
                        renderSplitter={(props) => <Splitter {...props} />}
                    >
                        {(node) => renderNode(node, setTarget)}
                    </Dockable.Row>
                    <Dockable.Panels<Types>>
                        {(tab) => (
                            <Dockable.Panel node={tab} className={styles.panel}>
                                {tab.component === "chart" ? (
                                    <ChartPanel
                                        kind={tab.data.kind}
                                        seed={tab.label.length}
                                        title={tab.label}
                                    />
                                ) : (
                                    <KpiPanel
                                        label={tab.label}
                                        seed={tab.data.seed}
                                    />
                                )}
                            </Dockable.Panel>
                        )}
                    </Dockable.Panels>
                    {/* `location` and `kind` come in the state; the region is the one reported */}
                    <Dockable.DropIndicator
                        data-region={target}
                        className={(state) =>
                            styles.dropIndicator(
                                state,
                                styles.regionOf(target, state.kind),
                            )
                        }
                    />
                </Dockable.Root>
            </div>
        </>
    );
}

type ReportTarget = (
    update: (current: string | undefined) => string | undefined,
) => void;

/** A row's child: a tabset, or a nested row rendered by this same function. */
function renderNode(
    node: TabsetNode<Types> | RowNode<Types>,
    report: ReportTarget,
) {
    if (node.type === "row") {
        return (
            <Dockable.Row
                node={node}
                renderSplitter={(props) => <Splitter {...props} />}
            >
                {(child) => renderNode(child, report)}
            </Dockable.Row>
        );
    }
    return <TabSet node={node} report={report} />;
}

/** A tabset that reports when a drag targets it (into it or beside it). */
function TabSet({
    node,
    report,
}: {
    node: TabsetNode<Types>;
    report: ReportTarget;
}) {
    const { dropTarget } = useTabSet(node).state;
    useEffect(() => {
        // the tabset a drag enters takes over; the one it leaves clears only itself
        report((current) =>
            dropTarget ? node.id : current === node.id ? undefined : current,
        );
    }, [dropTarget, node.id, report]);
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

/** The bar between two children of a row. */
function Splitter(props: RowSplitterProps<Types>) {
    return (
        <Dockable.Splitter
            {...props}
            aria-label="Resize"
            className={styles.splitter}
        />
    );
}

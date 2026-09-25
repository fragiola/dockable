"use client";

import {
    Actions,
    DockLocation,
    type IJsonModel,
    type IJsonTabNode,
    type LayoutEngine,
    Model,
    type TabNode,
} from "@fragiola/dockable";
import { ChartLine, ScrollText, Table2 } from "lucide-react";
import { useRef, useState } from "react";
import { Select } from "@/components/ui/select";
import { ChartPanel } from "../_kit/charts";
import { LogPanel, TablePanel } from "../_kit/data";
import { EngineBridge } from "../_kit/engine-bridge";
import { DockLayout } from "../_kit/layout";
import * as styles from "../_kit/styles";

const json: IJsonModel = {
    global: {},
    borders: [],
    layout: {
        type: "row",
        children: [
            {
                type: "tabset",
                children: [
                    { type: "tab", name: "Revenue", component: "chart" },
                    { type: "tab", name: "Orders", component: "table" },
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

function Content({ tab }: { tab: TabNode }) {
    switch (tab.getComponent()) {
        case "chart":
            return <ChartPanel seed={tab.getName().length * 7} />;
        case "table":
            return <TablePanel />;
        default:
            return <LogPanel />;
    }
}

export default function AddTabs() {
    const [model] = useState(() => Model.fromJson(json));
    const [engine, setEngine] = useState<LayoutEngine | null>(null);
    const [target, setTarget] = useState<Target>("active");
    const count = useRef(0);

    const add = (kind: (typeof KINDS)[number]) => {
        if (!engine) return;
        count.current += 1;
        const tab: IJsonTabNode = {
            type: "tab",
            name: `${kind.name} ${count.current}`,
            component: kind.component,
        };
        const root = model.getRootRow();
        // the active tabset, or the first one when none is active yet
        const tabset = model.getActiveTabset() ?? model.getFirstTabSet();
        if (target === "active" && tabset) {
            // dropped into the tabset's centre, at the end (-1), and selected
            engine.doAction(
                Actions.addTab(
                    tab,
                    tabset.getId(),
                    DockLocation.CENTER,
                    -1,
                    true,
                ),
            );
        } else if (root) {
            // dropped on an edge of the root row: a new tabset along that edge
            const edge =
                target === "right" ? DockLocation.RIGHT : DockLocation.BOTTOM;
            engine.doAction(Actions.addTab(tab, root.getId(), edge, -1, true));
        }
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className={styles.toolbar}>
                {KINDS.map((kind) => (
                    <button
                        key={kind.component}
                        type="button"
                        className={styles.button}
                        disabled={!engine}
                        onClick={() => add(kind)}
                    >
                        <kind.icon aria-hidden className="size-4" />
                        {`New ${kind.name.toLowerCase()}`}
                    </button>
                ))}
                <span className="ms-auto text-sm text-palette-accent/85">
                    Add to
                </span>
                <Select.Root
                    value={target}
                    onValueChange={(value) => setTarget(value as Target)}
                    items={TARGETS}
                >
                    <Select.Trigger
                        aria-label="Where to add"
                        data-testid="target"
                        className="w-64 shrink-0"
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
            <DockLayout
                model={model}
                renderContent={(tab) => <Content tab={tab} />}
            >
                <EngineBridge onEngine={setEngine} />
            </DockLayout>
        </div>
    );
}

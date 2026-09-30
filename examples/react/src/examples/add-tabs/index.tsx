"use client";

import {
    createModel,
    type LayoutJson,
    MAIN_LAYOUT,
    type TabOf,
} from "@fragiola/dockable";
import { ChartLine, ScrollText, Table2 } from "lucide-react";
import { useRef, useState } from "react";
import { Select } from "#/components/ui/select";
import { ChartPanel } from "../_kit/charts";
import { LogPanel, TablePanel } from "../_kit/data";
import { DockLayout } from "../_kit/layout";
import * as styles from "../_kit/styles";

// What the layout holds: each tab component and the type of its data.
type Types = {
    tabs: {
        chart: { name: string };
        table: { name: string };
        log: { name: string };
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
                    { component: "chart", data: { name: "Revenue" } },
                    { component: "table", data: { name: "Orders" } },
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

function Content({ tab }: { tab: TabOf<Types> }) {
    switch (tab.component) {
        case "chart":
            return <ChartPanel seed={tab.data.name.length * 7} />;
        case "table":
            return <TablePanel />;
        case "log":
            return <LogPanel />;
    }
}

export default function AddTabs() {
    const [model] = useState(() => createModel<Types>(json));
    const [target, setTarget] = useState<Target>("active");
    const count = useRef(0);

    // The toolbar is outside the layout: it runs commands on the model it owns, no engine needed.
    const add = (kind: (typeof KINDS)[number]) => {
        count.current += 1;
        const tab = {
            component: kind.component,
            data: { name: `${kind.name} ${count.current}` },
        };
        if (target === "active") {
            // the active tabset, or the first one when none is active yet
            const tabset = model.activeTabset() ?? model.tabsets()[0];
            // dropped into the tabset's centre, at the end (-1), and selected (with no tabset
            // left, into the layout itself: a new tabset)
            model.run("tab.add", {
                ...tab,
                to: tabset?.id ?? MAIN_LAYOUT,
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
        <div className="flex min-h-0 flex-1 flex-col">
            <div className={styles.toolbar}>
                {KINDS.map((kind) => (
                    <button
                        key={kind.component}
                        type="button"
                        className={styles.button}
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
            />
        </div>
    );
}

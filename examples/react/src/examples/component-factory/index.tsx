"use client";

import {
    createModel,
    type LayoutJson,
    type TabsetNode,
} from "@fragiola/dockable";
import { useDockable } from "@fragiola/dockable-react";
import { Plus } from "lucide-react";
import {
    type ReactNode,
    useEffect,
    useState,
    useSyncExternalStore,
} from "react";
import { DropdownMenu } from "#/components/ui/dropdown-menu";
import { DockLayout } from "../_kit/layout";
import * as styles from "../_kit/styles";
import { type Kind, renderFactory, TEMPLATES, type Types } from "./factory";

// Tabs whose `component` field selects their content (see factory.tsx). Content renders on
// demand (`renderOnDemand`, on by default): a tab's content mounts the first time it is shown and
// then stays mounted. The toolbar counts the mounted contents.

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 55,
                children: [
                    {
                        ...TEMPLATES.chart,
                        data: { ...TEMPLATES.chart.data, name: "Revenue" },
                    },
                    TEMPLATES.table,
                    {
                        component: "table",
                        data: { name: "Pending", status: "Pending" },
                    },
                ],
            },
            {
                type: "tabset",
                weight: 45,
                children: [
                    {
                        component: "markdown",
                        data: {
                            name: "README.md",
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

/** The "Add" menu of a tabset: a new tab of any kind, with its own data. */
function AddMenu({ tabset }: { tabset: TabsetNode<Types> }) {
    const { run } = useDockable<Types>();
    return (
        <DropdownMenu.Root>
            <DropdownMenu.Trigger
                aria-label="Add a tab"
                className={styles.iconButton}
            >
                <Plus aria-hidden className="size-3.5" />
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end">
                {KINDS.map(({ kind, title }) => (
                    <DropdownMenu.Item
                        key={kind}
                        onClick={() =>
                            run("tab.add", {
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
        () => model.tabs().length,
    );
    return (
        <>
            <div className={styles.toolbar}>
                <p
                    role="status"
                    data-testid="mounted"
                    className="text-sm text-palette-accent/85"
                >
                    {`Content mounted for ${mounted.size} of ${total} tabs`}
                </p>
            </div>
            <DockLayout
                model={model}
                renderActions={(tabset) => <AddMenu tabset={tabset} />}
                renderContent={(tab) => (
                    <Mounted id={tab.id} onMount={onMount}>
                        {renderFactory(tab)}
                    </Mounted>
                )}
            />
        </>
    );
}

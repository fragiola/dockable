"use client";

import {
    Actions,
    DockLocation,
    type IJsonModel,
    Model,
    type TabNode,
    type TabSetNode,
} from "@fragiola/dockable";
import { useDockable } from "@fragiola/dockable-react";
import { Plus } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { PanelBody } from "../_kit/card";
import { DockLayout } from "../_kit/layout";
import { useStageTheme } from "../_kit/stage-theme";
import * as styles from "../_kit/styles";
import { FACTORY, type Kind, TEMPLATES } from "./factory";

// Tabs whose `component` field selects their content (see factory.tsx). Content renders on
// demand (`enableRenderOnDemand`, on by default): a tab's content mounts the first time it is
// shown and then stays mounted. The toolbar counts the mounted contents.

const json: IJsonModel = {
    global: {},
    borders: [],
    layout: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 55,
                children: [
                    {
                        type: "tab",
                        component: "chart",
                        ...TEMPLATES.chart,
                        name: "Revenue",
                    },
                    { type: "tab", component: "table", ...TEMPLATES.table },
                    {
                        type: "tab",
                        component: "table",
                        name: "Pending",
                        config: { status: "Pending" },
                    },
                ],
            },
            {
                type: "tabset",
                weight: 45,
                children: [
                    {
                        type: "tab",
                        component: "markdown",
                        name: "README.md",
                        config: {
                            text: "# Component factory\nEach tab names a component and carries a config.\n- chart, table, markdown, form\n- add more with the + menu",
                        },
                    },
                    { type: "tab", component: "form", ...TEMPLATES.form },
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

/** The "Add" menu of a tabset: a new tab of any kind, with its own config. */
function AddMenu({ tabset }: { tabset: TabSetNode }) {
    const { engine } = useDockable();
    const [themeRef, theme] = useStageTheme();
    return (
        <DropdownMenu.Root>
            <DropdownMenu.Trigger
                ref={themeRef}
                aria-label="Add a tab"
                className={styles.iconButton}
            >
                <Plus aria-hidden className="size-3.5" />
            </DropdownMenu.Trigger>
            <DropdownMenu.Content data-example-theme={theme} align="end">
                {KINDS.map(({ kind, title }) => (
                    <DropdownMenu.Item
                        key={kind}
                        onClick={() =>
                            engine.doAction(
                                Actions.addTab(
                                    {
                                        type: "tab",
                                        component: kind,
                                        ...TEMPLATES[kind],
                                    },
                                    tabset.getId(),
                                    DockLocation.CENTER,
                                    -1,
                                    true, // select it: its content mounts now
                                ),
                            )
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

function renderFactory(tab: TabNode) {
    const create = FACTORY[tab.getComponent() ?? ""];
    return create ? (
        create(tab)
    ) : (
        <PanelBody title={tab.getName()}>
            <p className="text-palette-accent/85">
                {`No component named "${tab.getComponent()}".`}
            </p>
        </PanelBody>
    );
}

export default function ComponentFactory() {
    const [model] = useState(() => Model.fromJson(json));
    const [mounted, setMounted] = useState<ReadonlySet<string>>(new Set());
    const [onMount] = useState(
        () => (id: string) =>
            setMounted((set) => (set.has(id) ? set : new Set(set).add(id))),
    );
    let total = 0;
    model.visitNodes((node) => {
        if (node.getType() === "tab") total += 1;
    });
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
                    <Mounted id={tab.getId()} onMount={onMount}>
                        {renderFactory(tab)}
                    </Mounted>
                )}
            />
        </>
    );
}

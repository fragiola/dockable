import {
    type CommandResult,
    createModel,
    type LayoutJson,
    type Model,
    type TabsetNode,
} from "@fragiola/dockable";
import { useRef, useState } from "react";
import { Card } from "#/examples/_kit/card";
import { DockLayout } from "#/examples/_kit/layout";
import * as styles from "#/examples/_kit/styles";
import { useInspector } from "../../inspector/context";

// The command catalogue, run through `model.run` as any consumer would: one button per common
// command against the active tabset (else the first) and its selected tab, and the whole catalogue
// (`model.commands()`, what an assistant would get as tools) listed below them. The Inspector is
// on: each click is one entry in its log (name, payload, result), and the model JSON follows.

type Types = { tabs: { card: { name: string } } };

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 60,
                children: [
                    { component: "card", data: { name: "One" } },
                    { component: "card", data: { name: "Two" } },
                ],
            },
            {
                type: "row",
                weight: 40,
                children: [
                    {
                        type: "tabset",
                        children: [
                            { component: "card", data: { name: "Three" } },
                        ],
                    },
                    {
                        type: "tabset",
                        children: [
                            { component: "card", data: { name: "Four" } },
                        ],
                    },
                ],
            },
        ],
    },
};

function activeTabset(model: Model<Types>): TabsetNode<Types> | undefined {
    return model.activeTabset() ?? model.tabsets()[0];
}

function describe(result: CommandResult<unknown> | undefined): string {
    if (!result) return "nothing to do";
    return result.ok
        ? `ok ${JSON.stringify(result.value)}`
        : `${result.error.code}: ${result.error.message}`;
}

export default function CommandsScenario() {
    const [model] = useState(() => createModel<Types>(json));
    const added = useRef(0);
    const [last, setLast] = useState("");
    useInspector(model);

    const newTab = () => {
        added.current += 1;
        return {
            component: "card" as const,
            data: { name: `New ${added.current}` },
        };
    };

    const buttons: [string, () => CommandResult<unknown> | undefined][] = [
        [
            "Add tab",
            () => {
                const tabset = activeTabset(model);
                if (!tabset) return undefined;
                return model.run("tab.add", {
                    ...newTab(),
                    to: tabset.id,
                    select: true,
                });
            },
        ],
        [
            "Add two (group)",
            () => {
                const tabset = activeTabset(model);
                if (!tabset) return undefined;
                return model.run("batch", {
                    commands: [
                        {
                            command: "tab.add",
                            payload: { ...newTab(), to: tabset.id },
                        },
                        {
                            command: "tab.add",
                            payload: { ...newTab(), to: tabset.id },
                        },
                    ],
                });
            },
        ],
        [
            "Select next",
            () => {
                const tabset = activeTabset(model);
                if (!tabset || tabset.children.length === 0) return undefined;
                const next =
                    tabset.children[
                        (tabset.selected + 1) % tabset.children.length
                    ];
                return next
                    ? model.run("tab.select", { tab: next.id })
                    : undefined;
            },
        ],
        [
            "Move to next tabset",
            () => {
                const all = model.tabsets();
                const tabset = activeTabset(model);
                const tab = tabset ? model.selectedTab(tabset.id) : undefined;
                if (!tabset || !tab || all.length < 2) return undefined;
                const index = all.findIndex((t) => t.id === tabset.id);
                const target = all[(index + 1) % all.length];
                if (!target) return undefined;
                return model.run("tab.move", {
                    tab: tab.id,
                    to: target.id,
                    select: true,
                });
            },
        ],
        [
            "Rename",
            () => {
                const tabset = activeTabset(model);
                const tab = tabset ? model.selectedTab(tabset.id) : undefined;
                if (!tab) return undefined;
                return model.run("tab.update", {
                    tab: tab.id,
                    component: tab.component,
                    data: { ...tab.data, name: `${tab.data.name}*` },
                });
            },
        ],
        [
            "Maximize",
            () => {
                const tabset = activeTabset(model);
                if (!tabset) return undefined;
                return model.run("tabset.maximize", {
                    tabset: tabset.id,
                    value: model.maximizedTabset()?.id !== tabset.id,
                });
            },
        ],
        [
            "Even weights",
            () => {
                const row = model.root();
                if (!row) return undefined;
                return model.run("row.resize", {
                    row: row.id,
                    weights: row.children.map(() => 50),
                });
            },
        ],
        [
            "Delete tab",
            () => {
                const tabset = activeTabset(model);
                const tab = tabset ? model.selectedTab(tabset.id) : undefined;
                return tab
                    ? model.run("tab.close", { tab: tab.id })
                    : undefined;
            },
        ],
    ];

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className={styles.toolbar}>
                {buttons.map(([name, run]) => (
                    <button
                        key={name}
                        type="button"
                        className={styles.button}
                        onClick={() => setLast(`${name}: ${describe(run())}`)}
                    >
                        {name}
                    </button>
                ))}
                <output className="truncate text-xs text-palette-accent/85">
                    {last}
                </output>
            </div>
            <details className="px-3 text-xs">
                <summary className="cursor-pointer py-1">
                    {`The catalogue: ${model.commands().length} commands`}
                </summary>
                <dl className="grid max-h-48 grid-cols-[max-content_1fr] gap-x-3 gap-y-1 overflow-auto pb-2">
                    {model.commands().map((command) => (
                        <div key={command.name} className="contents">
                            <dt className="font-mono font-semibold">
                                {command.transient
                                    ? `${command.name} (transient)`
                                    : command.name}
                            </dt>
                            <dd className="text-palette-accent/85">
                                {command.description}
                            </dd>
                        </div>
                    ))}
                </dl>
            </details>
            <DockLayout
                model={model}
                renderContent={(tab) => <Card tab={tab} />}
                edgeIndicators
            />
        </div>
    );
}

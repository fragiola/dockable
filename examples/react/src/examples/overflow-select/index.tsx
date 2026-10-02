"use client";

import {
    createModel,
    Dockable,
    type LayoutJson,
    type RowNode,
    type RowSplitterProps,
    type TabJson,
    type TabOf,
    type TabsetNode,
    useDockable,
    useModelState,
    useTabOverflow,
} from "@fragiola/dockable-react";
import { type Ref, useEffect, useRef, useState } from "react";
import { Select } from "#/components/ui/select";
import { LogPanel } from "../_kit/data";
import * as styles from "./styles";

// Two answers to a strip with more tabs than fit, chosen per tabset by its data.
//
// "select": only the tabs that do not fit leave the strip. The engine measures the tab list and
// hides them (tab overflow), keeping the selected tab in view, and Dockable.TabOverflowTrigger
// (rendered only while tabs are hidden) is the trigger of a Fragiola Select listing just those.
// Picking one selects it, which brings it into the strip; another tab goes to the select in its
// place.
//
// "scroll": the strip keeps every tab and scrolls. Tab overflow is off (`overflow={false}`), and
// the selected tab scrolls itself into view.

// What the layout holds: an editor's tabs, each named by its label. A file and a tool's output
// carry their text, the terminal is a log, and Problems lists what is wrong where. A tabset's
// `overflow` picks how its strip overflows; a tabset without it (one a drop creates) uses the
// select.
type Types = {
    tabs: {
        file: { text: string };
        output: { text: string };
        terminal: undefined;
        problems: { items: { where: string; message: string }[] };
    };
    tabset: { overflow: "select" | "scroll" };
};

/** A file tab, its text given line by line. */
const file = (name: string, ...lines: string[]): TabJson<Types> => ({
    component: "file",
    label: name,
    data: { text: lines.join("\n") },
});

/** A tool tab that shows its output, given line by line. */
const output = (name: string, ...lines: string[]): TabJson<Types> => ({
    component: "output",
    label: name,
    data: { text: lines.join("\n") },
});

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                data: { overflow: "select" },
                weight: 55,
                children: [
                    file(
                        "main.ts",
                        'import { createElement } from "react";',
                        'import { createRoot } from "react-dom/client";',
                        'import { App } from "./App";',
                        "",
                        'const root = document.getElementById("root");',
                        "if (root) createRoot(root).render(createElement(App));",
                    ),
                    file(
                        "App.tsx",
                        'import { Layout } from "./layout";',
                        'import "./styles.css";',
                        "",
                        "export function App() {",
                        "    return <Layout />;",
                        "}",
                    ),
                    file(
                        "layout.tsx",
                        'import { createModel, Dockable } from "@fragiola/dockable-react";',
                        'import { useState } from "react";',
                        "",
                        "export function Layout() {",
                        "    const [model] = useState(() => createModel(json));",
                        "    return <Dockable.Root model={model} />;",
                        "}",
                    ),
                    file(
                        "styles.css",
                        ":root {",
                        "    color-scheme: light dark;",
                        "}",
                        "",
                        '[data-layout-path="/layout"] {',
                        "    height: 100dvh;",
                        "}",
                    ),
                    file(
                        "api.ts",
                        "export async function orders() {",
                        '    const response = await fetch("/api/orders");',
                        "    return response.json();",
                        "}",
                    ),
                    file(
                        "README.md",
                        "# Workspace",
                        "",
                        "A tabbed editor built with Dockable.",
                        "",
                        "- `pnpm dev` starts it",
                        "- `pnpm test` runs the tests",
                    ),
                    file(
                        "package.json",
                        "{",
                        '    "name": "workspace",',
                        '    "private": true,',
                        '    "type": "module"',
                        "}",
                    ),
                    file(
                        "vite.config.ts",
                        'import react from "@vitejs/plugin-react";',
                        'import { defineConfig } from "vite";',
                        "",
                        "export default defineConfig({ plugins: [react()] });",
                    ),
                    file(
                        "tsconfig.json",
                        "{",
                        '    "compilerOptions": {',
                        '        "strict": true,',
                        '        "jsx": "react-jsx"',
                        "    }",
                        "}",
                    ),
                    file(
                        "index.html",
                        "<!doctype html>",
                        '<div id="root"></div>',
                        '<script type="module" src="/src/main.ts"></script>',
                    ),
                    file(
                        "Toolbar.tsx",
                        "export function Toolbar() {",
                        '    return <header role="toolbar" />;',
                        "}",
                    ),
                    file(
                        "Sidebar.tsx",
                        "export function Sidebar() {",
                        "    return <nav />;",
                        "}",
                    ),
                ],
            },
            {
                type: "tabset",
                data: { overflow: "scroll" },
                weight: 45,
                children: [
                    { component: "terminal", label: "Terminal" },
                    {
                        component: "problems",
                        label: "Problems",
                        data: {
                            items: [
                                {
                                    where: "layout.tsx 6:51",
                                    message: "Cannot find name 'json'.",
                                },
                                {
                                    where: "api.ts 3:12",
                                    message: "The response is not checked.",
                                },
                            ],
                        },
                    },
                    output(
                        "Output",
                        "[vite] connected.",
                        "[vite] hot updated: /src/layout.tsx",
                    ),
                    output("Debug Console", "> root", '<div id="root"></div>'),
                    output(
                        "Ports",
                        "5173  vite dev server",
                        "4173  vite preview",
                    ),
                    output(
                        "Tests",
                        "✓ layout.test.tsx (3)",
                        "✓ api.test.ts (2)",
                        "",
                        "Tests  5 passed (5)",
                    ),
                    output(
                        "Source Control",
                        "M  src/layout.tsx",
                        "M  src/api.ts",
                        "?? src/styles.css",
                    ),
                    output(
                        "Call Stack",
                        "orders  api.ts:2",
                        "Layout  layout.tsx:6",
                    ),
                    output("Breakpoints", "api.ts:3", "layout.tsx:6"),
                    output(
                        "Search",
                        "createModel: 2 results in 1 file",
                        "layout.tsx:1, layout.tsx:6",
                    ),
                ],
            },
        ],
    },
};

export default function TabOverflow() {
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

/** A tab's content: `tab.data` and the component narrow together. */
function Content({ tab }: { tab: TabOf<Types> }) {
    switch (tab.component) {
        case "terminal":
            return <LogPanel />;
        case "problems":
            return (
                <ul className={styles.problems}>
                    {tab.data.items.map((item) => (
                        <li key={item.where} className={styles.problem}>
                            <span className={styles.problemWhere}>
                                {item.where}
                            </span>
                            {item.message}
                        </li>
                    ))}
                </ul>
            );
        case "file":
        case "output":
            return <pre className={styles.source}>{tab.data.text}</pre>;
    }
}

/** A tabset whose strip overflows as its data says: into a select, or by scrolling. */
function TabSet({ node }: { node: TabsetNode<Types> }) {
    return (
        <Dockable.TabSet node={node} className={styles.tabset}>
            <div className={styles.strip}>
                {node.data?.overflow === "scroll" ? (
                    <Dockable.TabList<Types>
                        aria-label="Tools"
                        overflow={false}
                        className={styles.scrollingTabList}
                    >
                        {(tab) => <ScrollingTab tab={tab} />}
                    </Dockable.TabList>
                ) : (
                    <>
                        <Dockable.TabList<Types>
                            aria-label="Files"
                            className={styles.tabList}
                        >
                            {(tab) => <Tab tab={tab} />}
                        </Dockable.TabList>
                        <OverflowSelect tabset={node} />
                    </>
                )}
            </div>
            <Dockable.TabSetContent />
        </Dockable.TabSet>
    );
}

/** The tabs that do not fit, listed in a Select whose trigger is the package's overflow trigger. */
function OverflowSelect({ tabset }: { tabset: TabsetNode<Types> }) {
    const { model } = useDockable<Types>();
    const { hiddenTabs } = useTabOverflow(tabset);
    return (
        <Select.Root
            value={null}
            onValueChange={(id) => {
                if (typeof id === "string") {
                    model.run("tab.select", { tabId: id });
                }
            }}
        >
            {/* the package's trigger (measured, shown only while tabs are hidden), rendered as
                the Select's trigger */}
            <Dockable.TabOverflowTrigger
                aria-label={`${hiddenTabs.length} more tabs`}
                render={<Select.Trigger className={styles.overflowTrigger} />}
            >
                {`+${hiddenTabs.length}`}
            </Dockable.TabOverflowTrigger>
            <Select.Content>
                {hiddenTabs.map((tab) => (
                    <Select.Item key={tab.id} value={tab.id}>
                        {tab.label}
                    </Select.Item>
                ))}
            </Select.Content>
        </Select.Root>
    );
}

/** A tab of a scrolling strip: scrolls itself into view when it becomes the selected one. */
function ScrollingTab({ tab }: { tab: TabOf<Types> }) {
    const ref = useRef<HTMLElement>(null);
    const selected = useModelState<Types, boolean>((_, model) =>
        model.is("tab-selected", { tabId: tab.id }),
    );
    useEffect(() => {
        if (selected) {
            ref.current?.scrollIntoView({
                block: "nearest",
                inline: "nearest",
            });
        }
    }, [selected]);
    return <Tab tab={tab} ref={ref} />;
}

function Tab({ tab, ref }: { tab: TabOf<Types>; ref?: Ref<HTMLElement> }) {
    return (
        <Dockable.Tab node={tab} ref={ref} className={styles.tab}>
            <span className={styles.tabName}>{tab.label}</span>
            <span aria-hidden="true" className={styles.tabMarker} />
        </Dockable.Tab>
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

import { Component } from "@angular/core";
import {
    createModel,
    DOCKABLE,
    type LayoutJson,
    type TabJson,
} from "@fragiola/dockable-angular";
import { LogPanel } from "../_kit/data";
import { OverflowSelect, ScrollingTab } from "./parts";
import * as styles from "./styles";

// Two answers to a strip with more tabs than fit, chosen per tabset by its data.
//
// "select": only the tabs that do not fit leave the strip. The engine measures the tab list and
// hides them (tab overflow), keeping the selected tab in view, and `[dockableTabOverflowTrigger]`
// (rendered only while tabs are hidden) is the trigger of a Fragiola Select listing just those.
// Picking one selects it, which brings it into the strip; another tab goes to the select in its
// place.
//
// "scroll": the strip keeps every tab and scrolls. Tab overflow is off (`[overflow]="false"`), and
// the selected tab scrolls itself into view.

// What the layout holds: an editor's tabs, each named by its label. A file and a tool's output
// carry their text, the terminal is a log, and Problems lists what is wrong where. A tabset's
// `overflow` picks how its strip overflows; a tabset without it (one a drop creates) uses the
// select.
export type Types = {
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

@Component({
    selector: "example-overflow-select",
    imports: [DOCKABLE, LogPanel, OverflowSelect, ScrollingTab],
    host: { class: "contents" },
    template: `
        <div [class]="styles.frame">
            <div [dockableRoot]="model" [class]="styles.root">
                <div dockableRow>
                    <ng-template [dockableRowChild]="model" let-node>
                        @if (node.type === "row") {
                            <div [dockableRow]="node"></div>
                        } @else {
                            <div [dockableTabSet]="node" [class]="styles.tabset">
                                <!-- a tabset whose strip overflows as its data says: into a select,
                                     or by scrolling -->
                                <div [class]="styles.strip">
                                    @if (node.data?.overflow === "scroll") {
                                        <div
                                            dockableTabList
                                            aria-label="Tools"
                                            [overflow]="false"
                                            [class]="styles.scrollingTabList"
                                        >
                                            <ng-template [dockableTabListItem]="model" let-tab>
                                                <div [dockableTab]="tab" exampleScrollingTab [class]="styles.tab">
                                                    <span [class]="styles.tabName">{{ tab.label }}</span>
                                                </div>
                                            </ng-template>
                                        </div>
                                    } @else {
                                        <div dockableTabList aria-label="Files" [class]="styles.tabList">
                                            <ng-template [dockableTabListItem]="model" let-tab>
                                                <div [dockableTab]="tab" [class]="styles.tab">
                                                    <span [class]="styles.tabName">{{ tab.label }}</span>
                                                </div>
                                            </ng-template>
                                        </div>
                                        <example-hidden-tabs-select />
                                    }
                                </div>
                                <div dockableTabSetContent></div>
                            </div>
                        }
                    </ng-template>
                    <ng-template dockableRowSplitter let-node="node" let-index="index">
                        <div
                            [dockableSplitter]="node"
                            [index]="index"
                            aria-label="Resize"
                            [class]="styles.splitter"
                        >
                            <span aria-hidden="true" [class]="styles.splitterGrip"></span>
                        </div>
                    </ng-template>
                </div>
                <ng-template [dockablePanels]="model" let-tab>
                    <div [dockablePanel]="tab" [class]="styles.panel">
                        <!-- a tab's content: tab.data and the component narrow together -->
                        @switch (tab.component) {
                            @case ("terminal") {
                                <kit-log-panel />
                            }
                            @case ("problems") {
                                <ul [class]="styles.problems">
                                    @for (item of tab.data.items; track item.where) {
                                        <li [class]="styles.problem">
                                            <span [class]="styles.problemWhere">{{ item.where }}</span>
                                            {{ item.message }}
                                        </li>
                                    }
                                </ul>
                            }
                            @case ("file") {
                                <pre [class]="styles.source">{{ tab.data.text }}</pre>
                            }
                            @case ("output") {
                                <pre [class]="styles.source">{{ tab.data.text }}</pre>
                            }
                        }
                    </div>
                </ng-template>
                <div
                    dockableDropIndicator
                    #indicator="dockableDropIndicator"
                    [class]="styles.dropIndicator(indicator.state())"
                ></div>
            </div>
        </div>
    `,
})
export default class TabOverflow {
    protected readonly styles = styles;
    protected readonly model = createModel<Types>(json);
}

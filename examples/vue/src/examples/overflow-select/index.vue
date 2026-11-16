<script setup lang="ts">
import {
    createModel,
    type LayoutJson,
    type TabJson,
} from "@fragiola/dockable-vue";
import Content from "./content.vue";
import { Dockable, type Types } from "./dockable";
import LayoutNode from "./layout-node.vue";
import Splitter from "./splitter.vue";
import * as styles from "./styles";

// Two answers to a strip with more tabs than fit, chosen per tabset by its data.
//
// "select": only the tabs that do not fit leave the strip. The engine measures the tab list and
// hides them (tab overflow), keeping the selected tab in view, and Dockable.TabOverflowTrigger
// (rendered only while tabs are hidden) is the trigger of a Fragiola Select listing just those.
// Picking one selects it, which brings it into the strip; another tab goes to the select in its
// place.
//
// "scroll": the strip keeps every tab and scrolls. Tab overflow is off (`:overflow="false"`), and
// the selected tab scrolls itself into view.

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
                        // `\u003C` is `<`: a plain closing script tag would end this component's
                        // own <script> block
                        '<script type="module" src="/src/main.ts">\u003C/script>',
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

const model = createModel<Types>(json);
</script>

<template>
    <div :class="styles.frame">
        <Dockable.Root :model="model" :class="styles.root">
            <Dockable.Row>
                <template #default="{ node }">
                    <LayoutNode :node="node" />
                </template>
                <template #splitter="{ props }">
                    <Splitter v-bind="props" />
                </template>
            </Dockable.Row>
            <Dockable.Panels v-slot="{ tab }">
                <Dockable.Panel :node="tab" :class="styles.panel">
                    <Content :tab="tab" />
                </Dockable.Panel>
            </Dockable.Panels>
            <Dockable.DropIndicator>
                <template #render="{ props, state }">
                    <div v-bind="props" :class="styles.dropIndicator(state)" />
                </template>
            </Dockable.DropIndicator>
        </Dockable.Root>
    </div>
</template>

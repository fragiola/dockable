import type { TabInit } from "@fragiola/dockable-vue";
import { h, type VNode } from "vue";
import ChartPanel from "../_kit/chart-panel.vue";
import { ORDERS } from "../_kit/data";
import PanelBody from "../_kit/panel-body.vue";
import TablePanel from "../_kit/table-panel.vue";
import ContactForm from "./contact-form.vue";
import type { Kind, TabOfKind, Types } from "./dockable";
import Markdown from "./markdown.vue";
import * as styles from "./styles";

// The factory: a tab's `component` picks what renders, and its `data` parameterises it. Both
// are plain JSON, so a saved layout restores the same content. Each renderer returns the vnode of
// its component (`h`), and index.vue renders it with `<component :is>`.

/** component name → how to render a tab of that component (each gets its own typed tab) */
export const FACTORY: {
    [K in Kind]: (tab: TabOfKind<K>) => VNode;
} = {
    chart: (tab) =>
        h(ChartPanel, {
            kind: tab.data.kind,
            seed: tab.data.seed,
            class: styles.chart,
        }),
    table: (tab) => {
        const { status } = tab.data;
        return h(TablePanel, {
            rows: status
                ? ORDERS.filter((row) => row.status === status)
                : ORDERS,
        });
    },
    markdown: (tab) => h(Markdown, { text: tab.data.text }),
    form: (tab) => h(ContactForm, { values: tab.data.values }),
};

/**
 * Renders a tab through the factory. Generic over the component, so `FACTORY[tab.component]` is
 * the renderer of that very component and takes the tab as it is.
 */
export function renderFactory<K extends Kind>(tab: TabOfKind<K>): VNode {
    const create: ((tab: TabOfKind<K>) => VNode) | undefined =
        FACTORY[tab.component];
    return create
        ? create(tab)
        : // a stored layout may name a component this build does not know
          h(PanelBody, { title: tab.label }, () =>
              h(
                  "p",
                  { class: styles.unknownComponent },
                  `No component named "${tab.component}".`,
              ),
          );
}

/** A new tab of each kind, for the "Add" menu: a `tab.add` init with its typed data. */
export const TEMPLATES: { [K in Kind]: TabInit<K, Types["tabs"][K]> } = {
    chart: {
        component: "chart",
        label: "Chart",
        data: { kind: "bar", seed: 23 },
    },
    table: { component: "table", label: "Orders", data: {} },
    markdown: {
        component: "markdown",
        label: "Notes.md",
        data: {
            text: "# Notes\nCreated from the Add menu.\n- component: markdown\n- data: { text }",
        },
    },
    form: {
        component: "form",
        label: "Contact",
        data: { values: { name: "", email: "" } },
    },
};

"use client";

import type { TabInit, TabNode } from "@fragiola/dockable";
import { type ReactNode, useState } from "react";
import { Input } from "#/components/atoms/fields";
import { PanelBody } from "../_kit/card";
import { ChartPanel } from "../_kit/charts";
import { ORDERS, TablePanel } from "../_kit/data";
import * as styles from "./styles";

// The factory: a tab's `component` picks what renders, and its `data` parameterises it. Both
// are plain JSON, so a saved layout restores the same content. The registry below types each
// component's data, so every renderer reads its own data with no cast.

export interface ChartData {
    kind: "line" | "bar" | "area";
    seed: number;
}
export interface TableData {
    status?: string;
}
export interface MarkdownData {
    text: string;
}
export interface ContactFormData {
    /** the form's initial values */
    values: { name: string; email: string };
}

/** What the layout holds: each tab component and the type of its data. */
export type Types = {
    tabs: {
        chart: ChartData;
        table: TableData;
        markdown: MarkdownData;
        form: ContactFormData;
    };
};

export type Kind = keyof Types["tabs"];

/** A tab of component `K`, with that component's data. */
export type TabOfKind<K extends Kind> = TabNode<K, Types["tabs"][K]>;

/** A tiny markdown subset (headings, list items, paragraphs): enough for the demo. */
function Markdown({ text }: { text: string }) {
    return (
        <PanelBody>
            {text.split("\n").map((line, index) => {
                const key = `${index}:${line}`;
                if (line.startsWith("# ")) {
                    return (
                        <h2 key={key} className={styles.markdownHeading}>
                            {line.slice(2)}
                        </h2>
                    );
                }
                if (line.startsWith("- ")) {
                    return (
                        <p key={key} className={styles.markdownItem}>
                            {line.slice(2)}
                        </p>
                    );
                }
                return line ? (
                    <p key={key} className={styles.markdownText}>
                        {line}
                    </p>
                ) : null;
            })}
        </PanelBody>
    );
}

function ContactForm({ values }: { values: ContactFormData["values"] }) {
    const [sent, setSent] = useState(false);
    return (
        <PanelBody title="Contact">
            <form
                className={styles.form}
                onSubmit={(event) => {
                    event.preventDefault();
                    setSent(true);
                }}
            >
                <Input.Template.Simple
                    label="Name"
                    defaultValue={values.name}
                />
                <Input.Template.Simple
                    label="Email"
                    type="email"
                    defaultValue={values.email}
                />
                <div className={styles.formActions}>
                    <button type="submit" className={styles.submit}>
                        Send
                    </button>
                    <span role="status" className={styles.formStatus}>
                        {sent ? "Sent." : null}
                    </span>
                </div>
            </form>
        </PanelBody>
    );
}

/** component name → how to render a tab of that component (each gets its own typed tab) */
export const FACTORY: {
    [K in Kind]: (tab: TabOfKind<K>) => ReactNode;
} = {
    chart: (tab) => (
        <ChartPanel
            kind={tab.data.kind}
            seed={tab.data.seed}
            className={styles.chart}
        />
    ),
    table: (tab) => {
        const { status } = tab.data;
        return (
            <TablePanel
                rows={
                    status
                        ? ORDERS.filter((row) => row.status === status)
                        : ORDERS
                }
            />
        );
    },
    markdown: (tab) => <Markdown text={tab.data.text} />,
    form: (tab) => <ContactForm values={tab.data.values} />,
};

/**
 * Renders a tab through the factory. Generic over the component, so `FACTORY[tab.component]` is
 * the renderer of that very component and takes the tab as it is.
 */
export function renderFactory<K extends Kind>(tab: TabOfKind<K>): ReactNode {
    const create: ((tab: TabOfKind<K>) => ReactNode) | undefined =
        FACTORY[tab.component];
    return create ? (
        create(tab)
    ) : (
        // a stored layout may name a component this build does not know
        <PanelBody title={tab.label}>
            <p className={styles.unknownComponent}>
                {`No component named "${tab.component}".`}
            </p>
        </PanelBody>
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

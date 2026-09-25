"use client";

import type { TabNode } from "@fragiola/dockable";
import { type ReactNode, useState } from "react";
import { Input } from "@/components/atoms/fields";
import { cn } from "@/lib/cn";
import { PanelBody } from "../_kit/card";
import { ChartPanel } from "../_kit/charts";
import { ORDERS, TablePanel } from "../_kit/data";
import * as styles from "../_kit/styles";

// The factory: a tab's `component` picks what renders, and its `config` parameterises it. Both
// are plain JSON, so a saved layout restores the same content.

export interface ChartConfig {
    kind: "line" | "bar" | "area";
    seed: number;
}
export interface TableConfig {
    status?: string;
}
export interface MarkdownConfig {
    text: string;
}
export interface FormConfig {
    name: string;
    email: string;
}

/** A tiny markdown subset (headings, list items, paragraphs): enough for the demo. */
function Markdown({ text }: { text: string }) {
    return (
        <PanelBody>
            {text.split("\n").map((line, index) => {
                const key = `${index}:${line}`;
                if (line.startsWith("# ")) {
                    return (
                        <h2 key={key} className="text-lg font-semibold">
                            {line.slice(2)}
                        </h2>
                    );
                }
                if (line.startsWith("- ")) {
                    return (
                        <p
                            key={key}
                            className="ps-3 before:me-2 before:content-['•']"
                        >
                            {line.slice(2)}
                        </p>
                    );
                }
                return line ? (
                    <p key={key} className="text-palette-accent/85">
                        {line}
                    </p>
                ) : null;
            })}
        </PanelBody>
    );
}

function ContactForm({ config }: { config: FormConfig }) {
    const [sent, setSent] = useState(false);
    return (
        <PanelBody title="Contact">
            <form
                className="flex max-w-sm flex-col gap-3"
                onSubmit={(event) => {
                    event.preventDefault();
                    setSent(true);
                }}
            >
                <Input.Template.Simple
                    label="Name"
                    defaultValue={config.name}
                />
                <Input.Template.Simple
                    label="Email"
                    type="email"
                    defaultValue={config.email}
                />
                <div className="flex items-center gap-3">
                    <button
                        type="submit"
                        className={cn("palette-blue", styles.solidButton)}
                    >
                        Send
                    </button>
                    <span
                        role="status"
                        className="text-sm text-palette-accent/85"
                    >
                        {sent ? "Sent." : null}
                    </span>
                </div>
            </form>
        </PanelBody>
    );
}

/** component name → how to render a tab of that component */
export const FACTORY: Record<string, (tab: TabNode) => ReactNode> = {
    chart: (tab) => {
        const config = tab.getConfig() as ChartConfig;
        return (
            <ChartPanel
                kind={config.kind}
                seed={config.seed}
                className="h-full"
            />
        );
    },
    table: (tab) => {
        const { status } = (tab.getConfig() ?? {}) as TableConfig;
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
    markdown: (tab) => (
        <Markdown text={(tab.getConfig() as MarkdownConfig).text} />
    ),
    form: (tab) => <ContactForm config={tab.getConfig() as FormConfig} />,
};

/** The JSON of a new tab of each kind, for the "Add" menu. */
export const TEMPLATES = {
    chart: {
        name: "Chart",
        config: { kind: "bar", seed: 23 } satisfies ChartConfig,
    },
    table: { name: "Orders", config: {} satisfies TableConfig },
    markdown: {
        name: "Notes.md",
        config: {
            text: "# Notes\nCreated from the Add menu.\n- component: markdown\n- config: { text }",
        } satisfies MarkdownConfig,
    },
    form: {
        name: "Contact",
        config: { name: "", email: "" } satisfies FormConfig,
    },
} as const;

export type Kind = keyof typeof TEMPLATES;

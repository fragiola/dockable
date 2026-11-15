import { NgComponentOutlet } from "@angular/common";
import { Component, computed, input, signal, type Type } from "@angular/core";
import type { TabInit, TabNode } from "@fragiola/dockable-angular";
import { InputSimple } from "#/components/atoms/fields";
import { PanelBody } from "../_kit/card";
import { ChartPanel } from "../_kit/charts";
import { ORDERS, TablePanel } from "../_kit/data";
import * as styles from "./styles";

// The factory: a tab's `component` picks what renders, and its `data` parameterises it. Both
// are plain JSON, so a saved layout restores the same content. The registry below types each
// component's data, so every renderer reads its own data with no cast. A renderer returns the
// Angular component to render and its inputs; `FactoryContent` renders it (`ngComponentOutlet`).

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

/** What renders a tab: a component and its inputs. */
export interface Rendered {
    component: Type<unknown>;
    inputs: Record<string, unknown>;
}

/** A tiny markdown subset (headings, list items, paragraphs): enough for the demo. */
@Component({
    selector: "example-factory-markdown",
    imports: [PanelBody],
    host: { class: "contents" },
    template: `
        <kit-panel-body>
            @for (line of lines(); track $index) {
                @if (line.startsWith("# ")) {
                    <h2 [class]="styles.markdownHeading">{{ line.slice(2) }}</h2>
                } @else if (line.startsWith("- ")) {
                    <p [class]="styles.markdownItem">{{ line.slice(2) }}</p>
                } @else if (line) {
                    <p [class]="styles.markdownText">{{ line }}</p>
                }
            }
        </kit-panel-body>
    `,
})
export class Markdown {
    readonly text = input.required<string>();
    protected readonly styles = styles;
    protected readonly lines = computed(() => this.text().split("\n"));
}

@Component({
    selector: "example-factory-contact-form",
    imports: [PanelBody, InputSimple],
    host: { class: "contents" },
    template: `
        <kit-panel-body title="Contact">
            <form [class]="styles.form" (submit)="$event.preventDefault(); sent.set(true)">
                <!-- the initial values, as the input's \`value\` attribute: what the user typed stays -->
                <kit-input-simple label="Name" [value]="values().name" />
                <kit-input-simple label="Email" type="email" [value]="values().email" />
                <div [class]="styles.formActions">
                    <button type="submit" [class]="styles.submit">Send</button>
                    <span role="status" [class]="styles.formStatus">{{ sent() ? "Sent." : "" }}</span>
                </div>
            </form>
        </kit-panel-body>
    `,
})
export class ContactForm {
    readonly values = input.required<ContactFormData["values"]>();
    protected readonly styles = styles;
    protected readonly sent = signal(false);
}

/** What a stored layout shows for a component this build does not know. */
@Component({
    selector: "example-factory-unknown",
    imports: [PanelBody],
    host: { class: "contents" },
    template: `
        <kit-panel-body [title]="label()">
            <p [class]="styles.unknownComponent">{{ 'No component named "' + component() + '".' }}</p>
        </kit-panel-body>
    `,
})
export class UnknownComponent {
    readonly label = input.required<string>();
    readonly component = input.required<string>();
    protected readonly styles = styles;
}

/** component name → how to render a tab of that component (each gets its own typed tab) */
export const FACTORY: {
    [K in Kind]: (tab: TabOfKind<K>) => Rendered;
} = {
    chart: (tab) => ({
        component: ChartPanel,
        inputs: {
            kind: tab.data.kind,
            seed: tab.data.seed,
            class: styles.chart,
        },
    }),
    table: (tab) => {
        const { status } = tab.data;
        return {
            component: TablePanel,
            inputs: {
                rows: status
                    ? ORDERS.filter((row) => row.status === status)
                    : ORDERS,
            },
        };
    },
    markdown: (tab) => ({
        component: Markdown,
        inputs: { text: tab.data.text },
    }),
    form: (tab) => ({
        component: ContactForm,
        inputs: { values: tab.data.values },
    }),
};

/**
 * Renders a tab through the factory. Generic over the component, so `FACTORY[tab.component]` is
 * the renderer of that very component and takes the tab as it is.
 */
export function renderFactory<K extends Kind>(tab: TabOfKind<K>): Rendered {
    const create: ((tab: TabOfKind<K>) => Rendered) | undefined =
        FACTORY[tab.component];
    return create
        ? create(tab)
        : // a stored layout may name a component this build does not know
          {
              component: UnknownComponent,
              inputs: { label: tab.label, component: tab.component },
          };
}

/** A tab's content, from the factory: rendered again only when the tab changes. */
@Component({
    selector: "example-factory-content",
    imports: [NgComponentOutlet],
    host: { class: "contents" },
    template: `<ng-container *ngComponentOutlet="rendered().component; inputs: rendered().inputs" />`,
})
export class FactoryContent {
    readonly tab = input.required<TabOfKind<Kind>>();
    protected readonly rendered = computed(() => renderFactory(this.tab()));
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

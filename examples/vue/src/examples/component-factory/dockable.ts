import { type TabNode, typedDockable } from "@fragiola/dockable-vue";

// The registry types each component's data, so every renderer of the factory (factory.ts) reads
// its own data with no cast.

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

// The primitives typed by Types: `tab` in a slot is a tab of this layout.
export const Dockable = typedDockable<Types>();

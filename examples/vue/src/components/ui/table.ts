// Vue port of the Fragiola UI table (examples/react/src/components/ui/table.tsx): native table
// elements with the same classes and palette roles (no primitive library).

import { defineComponent, h } from "vue";
import { cn } from "#/lib/cn";

function part(name: string, tag: string, slot: string, classes: string) {
    return defineComponent({
        name,
        inheritAttrs: false,
        setup(_, { attrs, slots }) {
            return () =>
                h(
                    tag,
                    {
                        "data-slot": slot,
                        ...attrs,
                        class: cn(classes, attrs.class as string),
                    },
                    slots.default?.(),
                );
        },
    });
}

const TableRoot = defineComponent({
    name: "TableRoot",
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
        return () =>
            h("div", { class: "relative w-full overflow-auto" }, [
                h(
                    "table",
                    {
                        "data-slot": "table",
                        ...attrs,
                        class: cn(
                            "w-full caption-bottom text-sm",
                            attrs.class as string,
                        ),
                    },
                    slots.default?.(),
                ),
            ]);
    },
});

export const Table = {
    Root: TableRoot,
    Header: part("TableHeader", "thead", "table-header", "[&_tr]:border-b"),
    Body: part(
        "TableBody",
        "tbody",
        "table-body",
        "[&_tr:last-child]:border-0",
    ),
    Footer: part(
        "TableFooter",
        "tfoot",
        "table-footer",
        "border-t border-palette-line bg-palette-soft font-medium",
    ),
    Row: part(
        "TableRow",
        "tr",
        "table-row",
        cn(
            "border-b border-palette-line transition-colors hover:bg-palette-soft",
            "data-[state=selected]:bg-palette-soft",
        ),
    ),
    Head: part(
        "TableHead",
        "th",
        "table-head",
        "h-10 px-3 text-start align-middle font-medium text-palette-contrast",
    ),
    Cell: part(
        "TableCell",
        "td",
        "table-cell",
        "p-3 align-middle text-palette-accent/85",
    ),
    Caption: part(
        "TableCaption",
        "caption",
        "table-caption",
        "mt-4 text-sm text-palette-accent/85",
    ),
};

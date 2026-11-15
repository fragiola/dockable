// Angular port of the Fragiola UI table (examples/react/src/components/ui/table.tsx): native table
// elements with the same classes and palette roles (no primitive library). `<kit-table>` is the
// scrolling wrapper and its `<table>`; the rows and cells are directives on the native elements:
//
//     <kit-table>
//         <thead kitTableHeader><tr kitTableRow><th kitTableHead>Order</th></tr></thead>
//         <tbody kitTableBody><tr kitTableRow><td kitTableCell>#1042</td></tr></tbody>
//     </kit-table>

import { Component, computed, Directive, input } from "@angular/core";
import { cn } from "#/lib/cn";

@Component({
    selector: "kit-table",
    host: { class: "contents" },
    template: `
        <div class="relative w-full overflow-auto">
            <table data-slot="table" [class]="classes()"><ng-content /></table>
        </div>
    `,
})
export class Table {
    /** Classes of the `<table>` (the host is `display: contents`). */
    readonly class = input<string>();
    protected readonly classes = computed(() =>
        cn("w-full caption-bottom text-sm", this.class()),
    );
}

@Directive({
    selector: "thead[kitTableHeader]",
    host: { "data-slot": "table-header", "[class]": "classes()" },
})
export class TableHeader {
    readonly class = input<string>();
    protected readonly classes = computed(() =>
        cn("[&_tr]:border-b", this.class()),
    );
}

@Directive({
    selector: "tbody[kitTableBody]",
    host: { "data-slot": "table-body", "[class]": "classes()" },
})
export class TableBody {
    readonly class = input<string>();
    protected readonly classes = computed(() =>
        cn("[&_tr:last-child]:border-0", this.class()),
    );
}

@Directive({
    selector: "tfoot[kitTableFooter]",
    host: { "data-slot": "table-footer", "[class]": "classes()" },
})
export class TableFooter {
    readonly class = input<string>();
    protected readonly classes = computed(() =>
        cn(
            "border-t border-palette-line bg-palette-soft font-medium",
            this.class(),
        ),
    );
}

@Directive({
    selector: "tr[kitTableRow]",
    host: { "data-slot": "table-row", "[class]": "classes()" },
})
export class TableRow {
    readonly class = input<string>();
    protected readonly classes = computed(() =>
        cn(
            "border-b border-palette-line transition-colors hover:bg-palette-soft",
            "data-[state=selected]:bg-palette-soft",
            this.class(),
        ),
    );
}

@Directive({
    selector: "th[kitTableHead]",
    host: { "data-slot": "table-head", "[class]": "classes()" },
})
export class TableHead {
    readonly class = input<string>();
    protected readonly classes = computed(() =>
        cn(
            "h-10 px-3 text-start align-middle font-medium text-palette-contrast",
            this.class(),
        ),
    );
}

@Directive({
    selector: "td[kitTableCell]",
    host: { "data-slot": "table-cell", "[class]": "classes()" },
})
export class TableCell {
    readonly class = input<string>();
    protected readonly classes = computed(() =>
        cn("p-3 align-middle text-palette-accent/85", this.class()),
    );
}

@Directive({
    selector: "caption[kitTableCaption]",
    host: { "data-slot": "table-caption", "[class]": "classes()" },
})
export class TableCaption {
    readonly class = input<string>();
    protected readonly classes = computed(() =>
        cn("mt-4 text-sm text-palette-accent/85", this.class()),
    );
}

/** Every part of a table, for a component's `imports`. */
export const TABLE = [
    Table,
    TableHeader,
    TableBody,
    TableFooter,
    TableRow,
    TableHead,
    TableCell,
    TableCaption,
] as const;

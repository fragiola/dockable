import { Component, DestroyRef, inject, input, signal } from "@angular/core";
import { TABLE } from "#/components/ui/table";

// Demo content: a table of orders, and a log that grows. The same as examples/react's
// `_kit/data.tsx`.

export interface Row {
    id: string;
    name: string;
    status: string;
    amount: number;
}

export const ORDERS: Row[] = [
    { id: "#1042", name: "Ada Lovelace", status: "Paid", amount: 320 },
    { id: "#1043", name: "Grace Hopper", status: "Pending", amount: 145 },
    { id: "#1044", name: "Alan Turing", status: "Paid", amount: 980 },
    { id: "#1045", name: "Katherine Johnson", status: "Refunded", amount: 60 },
    { id: "#1046", name: "Edsger Dijkstra", status: "Paid", amount: 410 },
    { id: "#1047", name: "Barbara Liskov", status: "Pending", amount: 275 },
];

export const LOG_LINES = [
    "info  server listening on :8080",
    "info  GET /api/orders 200 12ms",
    "warn  slow query: orders by customer (320ms)",
    "info  GET /api/charts 200 8ms",
    "error payment provider timeout, retrying",
    "info  POST /api/orders 201 21ms",
];

/** A Fragiola table of orders. */
@Component({
    selector: "kit-table-panel",
    imports: [TABLE],
    host: { class: "contents" },
    template: `
        <div class="p-3">
            <kit-table>
                <thead kitTableHeader>
                    <tr kitTableRow>
                        <th kitTableHead>Order</th>
                        <th kitTableHead>Customer</th>
                        <th kitTableHead>Status</th>
                        <th kitTableHead class="text-end">Amount</th>
                    </tr>
                </thead>
                <tbody kitTableBody>
                    @for (row of rows(); track row.id) {
                        <tr kitTableRow>
                            <td kitTableCell>{{ row.id }}</td>
                            <td kitTableCell>{{ row.name }}</td>
                            <td kitTableCell>{{ row.status }}</td>
                            <td kitTableCell class="text-end tabular-nums">{{ "$" + row.amount }}</td>
                        </tr>
                    }
                </tbody>
            </kit-table>
        </div>
    `,
})
export class TablePanel {
    readonly rows = input<Row[]>(ORDERS);
}

/** A log that appends a line every `interval` ms while it is rendered. */
@Component({
    selector: "kit-log-panel",
    host: { class: "contents" },
    template: `<pre class="m-0 p-3 font-mono text-xs leading-5 whitespace-pre-wrap">@for (line of lines(); track $index) {<div class="text-palette-accent/85">{{ line }}</div>}</pre>`,
})
export class LogPanel {
    readonly interval = input(1500);
    protected readonly lines = signal(LOG_LINES.slice(0, 3));

    constructor() {
        // the interval is read once, when the log starts (as React's effect on mount)
        let timer: ReturnType<typeof setInterval> | undefined;
        let destroyed = false;
        queueMicrotask(() => {
            if (destroyed) return;
            timer = setInterval(() => {
                this.lines.update((current) =>
                    [
                        ...current,
                        LOG_LINES[current.length % LOG_LINES.length] ?? "",
                    ].slice(-200),
                );
            }, this.interval());
        });
        inject(DestroyRef).onDestroy(() => {
            destroyed = true;
            clearInterval(timer);
        });
    }
}

// Demo content: the orders a table shows, and the lines a growing log appends. The same as
// examples/react's `_kit/data.tsx`; TablePanel.vue and LogPanel.vue render them.

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

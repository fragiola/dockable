"use client";

import { useEffect, useState } from "react";
import { Table } from "@/components/ui/table";

// Demo content: a Fragiola UI table of orders, and a log that grows while mounted.

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

/** A Fragiola table of orders. */
export function TablePanel({ rows = ORDERS }: { rows?: Row[] }) {
    return (
        <div className="p-3">
            <Table.Root>
                <Table.Header>
                    <Table.Row>
                        <Table.Head>Order</Table.Head>
                        <Table.Head>Customer</Table.Head>
                        <Table.Head>Status</Table.Head>
                        <Table.Head className="text-end">Amount</Table.Head>
                    </Table.Row>
                </Table.Header>
                <Table.Body>
                    {rows.map((row) => (
                        <Table.Row key={row.id}>
                            <Table.Cell>{row.id}</Table.Cell>
                            <Table.Cell>{row.name}</Table.Cell>
                            <Table.Cell>{row.status}</Table.Cell>
                            <Table.Cell className="text-end tabular-nums">
                                {`$${row.amount}`}
                            </Table.Cell>
                        </Table.Row>
                    ))}
                </Table.Body>
            </Table.Root>
        </div>
    );
}

const LOG_LINES = [
    "info  server listening on :8080",
    "info  GET /api/orders 200 12ms",
    "warn  slow query: orders by customer (320ms)",
    "info  GET /api/charts 200 8ms",
    "error payment provider timeout, retrying",
    "info  POST /api/orders 201 21ms",
];

/** A log that appends a line every `interval` ms while mounted. */
export function LogPanel({ interval = 1500 }: { interval?: number }) {
    const [lines, setLines] = useState(() => LOG_LINES.slice(0, 3));
    useEffect(() => {
        const timer = setInterval(() => {
            setLines((current) =>
                [
                    ...current,
                    LOG_LINES[current.length % LOG_LINES.length] ?? "",
                ].slice(-200),
            );
        }, interval);
        return () => clearInterval(timer);
    }, [interval]);
    return (
        <pre className="m-0 p-3 font-mono text-xs leading-5 whitespace-pre-wrap">
            {lines.map((line, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: an append-only log
                <div key={index} className="text-palette-accent/85">
                    {line}
                </div>
            ))}
        </pre>
    );
}

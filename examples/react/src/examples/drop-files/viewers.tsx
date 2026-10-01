"use client";

import type { EChartsOption } from "echarts";
import {
    Braces,
    FileSpreadsheet,
    FileText,
    ImageIcon,
    TriangleAlert,
    Upload,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Chart } from "#/components/ui/chart";
import { Table } from "#/components/ui/table";
import { useChartKey } from "../_kit/charts";
import { type Csv, formatSize, numericColumns } from "./files";
import * as styles from "./styles";

// What a tab shows for each kind of file. None of this is Dockable: a panel renders whatever the
// app gives it.

/** The first tab: where to drop, and what each kind of file becomes. */
export function Welcome() {
    return (
        <div className={styles.welcome}>
            <div className={styles.dropTarget}>
                <Upload aria-hidden="true" className={styles.dropIcon} />
                <p className={styles.dropTitle}>Drop files from your desktop</p>
                <p className={styles.dropText}>
                    On a tabset to open them there, on its edge to split it, or
                    on the layout's edge to dock them.
                </p>
                <ul className={styles.kinds}>
                    <Kind
                        icon={
                            <FileSpreadsheet
                                aria-hidden="true"
                                className={styles.kindIcon}
                            />
                        }
                    >
                        A CSV opens as a table, with a chart of its numbers
                    </Kind>
                    <Kind
                        icon={
                            <ImageIcon
                                aria-hidden="true"
                                className={styles.kindIcon}
                            />
                        }
                    >
                        An image opens in a viewer
                    </Kind>
                    <Kind
                        icon={
                            <Braces
                                aria-hidden="true"
                                className={styles.kindIcon}
                            />
                        }
                    >
                        A saved layout (.json) replaces this one
                    </Kind>
                    <Kind
                        icon={
                            <FileText
                                aria-hidden="true"
                                className={styles.kindIcon}
                            />
                        }
                    >
                        Anything else shows its name, type and size
                    </Kind>
                </ul>
            </div>
        </div>
    );
}

function Kind({ icon, children }: { icon: ReactNode; children: ReactNode }) {
    return (
        <li className={styles.kind}>
            {icon}
            {children}
        </li>
    );
}

export function Pending() {
    return <p className={styles.note}>Reading the file…</p>;
}

export function CsvTable({ csv }: { csv: Csv }) {
    return (
        <div className={styles.tableWrap}>
            <Table.Root>
                <Table.Header>
                    <Table.Row>
                        {csv.columns.map((column, cell) => (
                            // biome-ignore lint/suspicious/noArrayIndexKey: a header may repeat a name or be empty; columns never reorder
                            <Table.Head key={cell}>{column}</Table.Head>
                        ))}
                    </Table.Row>
                </Table.Header>
                <Table.Body>
                    {csv.rows.map((row, index) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: rows of a file, never reordered
                        <Table.Row key={index}>
                            {csv.columns.map((_, cell) => (
                                // biome-ignore lint/suspicious/noArrayIndexKey: cells of a row, by column
                                <Table.Cell key={cell}>{row[cell]}</Table.Cell>
                            ))}
                        </Table.Row>
                    ))}
                </Table.Body>
            </Table.Root>
        </div>
    );
}

/** The CSV's numeric columns as bars, its first column as the labels. */
export function CsvChart({ csv }: { csv: Csv }) {
    const ref = useRef<HTMLDivElement | null>(null);
    const chartKey = useChartKey(ref);
    const option = useMemo<EChartsOption>(
        () => ({
            grid: { left: 44, right: 16, top: 16, bottom: 48 },
            tooltip: { trigger: "axis" },
            legend: { bottom: 0 },
            xAxis: {
                type: "category",
                data: csv.rows.map((row) => row[0] ?? ""),
            },
            yAxis: { type: "value" },
            series: numericColumns(csv).map((index) => ({
                type: "bar",
                name: csv.columns[index],
                data: csv.rows.map((row) => Number(row[index])),
            })),
        }),
        [csv],
    );
    return (
        <div ref={ref} className={styles.chart}>
            {chartKey === null ? null : (
                <Chart
                    key={chartKey}
                    option={option}
                    className={styles.chartCanvas}
                />
            )}
        </div>
    );
}

export function ImageViewer({ file }: { file: File }) {
    const [url, setUrl] = useState<string | null>(null);
    useEffect(() => {
        const objectUrl = URL.createObjectURL(file);
        setUrl(objectUrl);
        return () => URL.revokeObjectURL(objectUrl);
    }, [file]);
    return (
        <div className={styles.imageViewer}>
            {url ? (
                // a plain <img>: the source is a local object URL, which an image optimizer cannot fetch
                <img src={url} alt={file.name} className={styles.image} />
            ) : null}
            <p
                className={styles.caption}
            >{`${file.type} · ${formatSize(file.size)}`}</p>
        </div>
    );
}

export function FileInfo({ type, size }: { type: string; size: number }) {
    return (
        <div className={styles.info}>
            <FileText aria-hidden="true" className={styles.infoIcon} />
            <p>{`${type || "unknown type"} · ${formatSize(size)}`}</p>
            <p className={styles.note}>No viewer for this kind of file.</p>
        </div>
    );
}

export function ErrorNote({ message }: { message: string }) {
    return (
        <div role="alert" className={styles.error}>
            <TriangleAlert aria-hidden="true" className={styles.errorIcon} />
            <p>{message}</p>
        </div>
    );
}

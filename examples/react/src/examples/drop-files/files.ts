// What the example does with a file, apart from the layout: what kind it is, a minimal CSV parser,
// and the sample files the toolbar opens when you have none at hand.

export type FileKind = "csv" | "image" | "layout" | "other";

export function kindOf(file: File): FileKind {
    if (file.type === "text/csv" || /\.csv$/i.test(file.name)) return "csv";
    if (file.type.startsWith("image/")) return "image";
    if (file.type === "application/json" || /\.json$/i.test(file.name)) {
        return "layout";
    }
    return "other";
}

export interface Csv {
    columns: string[];
    rows: string[][];
}

/** A minimal CSV parser: one row per line, commas between cells (no quoted commas). */
export function parseCsv(text: string): Csv {
    const [header = [], ...rows] = text
        .trim()
        .split(/\r?\n/)
        .filter((line) => line.trim() !== "")
        .map((line) => line.split(",").map((cell) => cell.trim()));
    return { columns: header, rows: rows.slice(0, 200) };
}

/** The columns whose every cell is a number: what the chart of a CSV plots. */
export function numericColumns(csv: Csv): number[] {
    return csv.columns.flatMap((_, index) =>
        index > 0 &&
        csv.rows.length > 0 &&
        csv.rows.every(
            (row) => row[index] !== "" && !Number.isNaN(Number(row[index])),
        )
            ? [index]
            : [],
    );
}

export function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const SALES = `month,visitors,signups,orders
Jan,1200,85,40
Feb,1350,92,46
Mar,1610,120,58
Apr,1480,104,51
May,1920,151,77
Jun,2240,178,93`;

const BADGE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160">
<rect width="240" height="160" rx="16" fill="#1d4ed8"/>
<circle cx="70" cy="80" r="36" fill="#93c5fd"/>
<rect x="124" y="52" width="84" height="14" rx="7" fill="#dbeafe"/>
<rect x="124" y="78" width="60" height="14" rx="7" fill="#bfdbfe"/>
<rect x="124" y="104" width="72" height="14" rx="7" fill="#93c5fd"/>
</svg>`;

/** Files built in the page, as a drop from the desktop would bring them. */
export function sampleFiles(): File[] {
    return [
        new File([SALES], "sales.csv", { type: "text/csv" }),
        new File([BADGE], "badge.svg", { type: "image/svg+xml" }),
    ];
}

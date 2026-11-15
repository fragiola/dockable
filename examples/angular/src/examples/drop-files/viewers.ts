import { Component, computed, effect, input, signal } from "@angular/core";
import {
    LucideBraces,
    LucideFileSpreadsheet,
    LucideFileText,
    LucideImage,
    LucideTriangleAlert,
    LucideUpload,
} from "@lucide/angular";
import type { EChartsOption } from "echarts";
import { Chart } from "#/components/ui/chart";
import { TABLE } from "#/components/ui/table";
import { type Csv, formatSize, numericColumns } from "./files";
import * as styles from "./styles";

// What a tab shows for each kind of file. None of this is Dockable: a panel renders whatever the
// app gives it.

/** The first tab: where to drop, and what each kind of file becomes. */
@Component({
    selector: "example-drop-files-welcome",
    imports: [
        LucideUpload,
        LucideFileSpreadsheet,
        LucideImage,
        LucideBraces,
        LucideFileText,
    ],
    host: { class: "contents" },
    template: `
        <div [class]="styles.welcome">
            <div [class]="styles.dropTarget">
                <svg lucideUpload aria-hidden="true" [class]="styles.dropIcon"></svg>
                <p [class]="styles.dropTitle">Drop files from your desktop</p>
                <p [class]="styles.dropText">
                    On a tabset to open them there, on its edge to split it, or on the layout's edge
                    to dock them.
                </p>
                <ul [class]="styles.kinds">
                    <li [class]="styles.kind">
                        <svg lucideFileSpreadsheet aria-hidden="true" [class]="styles.kindIcon"></svg>
                        A CSV opens as a table, with a chart of its numbers
                    </li>
                    <li [class]="styles.kind">
                        <svg lucideImage aria-hidden="true" [class]="styles.kindIcon"></svg>
                        An image opens in a viewer
                    </li>
                    <li [class]="styles.kind">
                        <svg lucideBraces aria-hidden="true" [class]="styles.kindIcon"></svg>
                        A saved layout (.json) replaces this one
                    </li>
                    <li [class]="styles.kind">
                        <svg lucideFileText aria-hidden="true" [class]="styles.kindIcon"></svg>
                        Anything else shows its name, type and size
                    </li>
                </ul>
            </div>
        </div>
    `,
})
export class Welcome {
    protected readonly styles = styles;
}

@Component({
    selector: "example-drop-files-pending",
    host: { class: "contents" },
    template: `<p [class]="styles.note">Reading the file…</p>`,
})
export class Pending {
    protected readonly styles = styles;
}

@Component({
    selector: "example-drop-files-table",
    imports: [TABLE],
    host: { class: "contents" },
    template: `
        <div [class]="styles.tableWrap">
            <kit-table>
                <thead kitTableHeader>
                    <tr kitTableRow>
                        <!-- a header may repeat a name or be empty; columns never reorder -->
                        @for (column of csv().columns; track $index) {
                            <th kitTableHead>{{ column }}</th>
                        }
                    </tr>
                </thead>
                <tbody kitTableBody>
                    @for (row of csv().rows; track $index) {
                        <tr kitTableRow>
                            @for (column of csv().columns; track $index; let cell = $index) {
                                <td kitTableCell>{{ row[cell] }}</td>
                            }
                        </tr>
                    }
                </tbody>
            </kit-table>
        </div>
    `,
})
export class CsvTable {
    readonly csv = input.required<Csv>();
    protected readonly styles = styles;
}

/** The CSV's numeric columns as bars, its first column as the labels. */
@Component({
    selector: "example-drop-files-chart",
    imports: [Chart],
    host: { class: "contents" },
    template: `
        <div [class]="styles.chart">
            <kit-chart [option]="option()" [class]="styles.chartCanvas" />
        </div>
    `,
})
export class CsvChart {
    readonly csv = input.required<Csv>();
    protected readonly styles = styles;
    protected readonly option = computed<EChartsOption>(() => {
        const csv = this.csv();
        return {
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
        };
    });
}

@Component({
    selector: "example-drop-files-image",
    host: { class: "contents" },
    template: `
        <div [class]="styles.imageViewer">
            @if (url(); as src) {
                <img [src]="src" [alt]="file().name" [class]="styles.image" />
            }
            <p [class]="styles.caption">{{ caption() }}</p>
        </div>
    `,
})
export class ImageViewer {
    readonly file = input.required<File>();
    protected readonly styles = styles;
    protected readonly url = signal<string | null>(null);
    protected readonly caption = computed(
        () => `${this.file().type} · ${formatSize(this.file().size)}`,
    );

    constructor() {
        effect((onCleanup) => {
            const objectUrl = URL.createObjectURL(this.file());
            this.url.set(objectUrl);
            onCleanup(() => URL.revokeObjectURL(objectUrl));
        });
    }
}

@Component({
    selector: "example-drop-files-info",
    imports: [LucideFileText],
    host: { class: "contents" },
    template: `
        <div [class]="styles.info">
            <svg lucideFileText aria-hidden="true" [class]="styles.infoIcon"></svg>
            <p>{{ (type() || "unknown type") + " · " + formatSize(size()) }}</p>
            <p [class]="styles.note">No viewer for this kind of file.</p>
        </div>
    `,
})
export class FileInfo {
    readonly type = input.required<string>();
    readonly size = input.required<number>();
    protected readonly styles = styles;
    protected readonly formatSize = formatSize;
}

@Component({
    selector: "example-drop-files-error",
    imports: [LucideTriangleAlert],
    host: { class: "contents" },
    template: `
        <div role="alert" [class]="styles.error">
            <svg lucideTriangleAlert aria-hidden="true" [class]="styles.errorIcon"></svg>
            <p>{{ message() }}</p>
        </div>
    `,
})
export class ErrorNote {
    readonly message = input.required<string>();
    protected readonly styles = styles;
}

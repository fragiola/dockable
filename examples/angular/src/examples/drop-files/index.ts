import { Component, signal } from "@angular/core";
import {
    createModel,
    DOCKABLE,
    type LayoutJson,
    type Model,
    type OnExternalDrag,
} from "@fragiola/dockable-angular";
import { LucideFolderOpen } from "@lucide/angular";
import {
    type Csv,
    kindOf,
    numericColumns,
    parseCsv,
    sampleFiles,
} from "./files";
import * as styles from "./styles";
import {
    CsvChart,
    CsvTable,
    ErrorNote,
    FileInfo,
    ImageViewer,
    Pending,
    Welcome,
} from "./viewers";

// Open files from the desktop by dropping them on the layout. A file dragged in from outside the
// page is an external drag: `externalDrag` on the root says whether to take it, and which tab the
// drop creates, where it lands (a tabset, its edge, the layout's edge). Once dropped, the app reads
// the file and turns that tab into the right viewer:
//
//   a CSV        a table, and a chart of its numeric columns beside it
//   an image     a viewer
//   a layout     a saved layout (.json) replaces this one, validated by `model.dispatch`
//   the rest     its name, type and size
//
// No files at hand? "Open sample files" runs the same code on a CSV and an image built in the page.

type Types = {
    tabs: {
        welcome: undefined;
        pending: undefined;
        table: { csv: Csv };
        chart: { csv: Csv };
        image: undefined;
        info: { type: string; size: number };
        error: { message: string };
    };
};

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 50,
                children: [{ component: "welcome", label: "Open files" }],
            },
            {
                type: "tabset",
                weight: 50,
                children: [{ component: "welcome", label: "Or here" }],
            },
        ],
    },
};

/**
 * Turns a tab into the viewer of a file. A parsed CSV is small JSON, so it goes in the tab's
 * typed data (it saves with the layout); an image is a File, which is not JSON, so it stays out
 * of the model, kept by the app under the tab's id (`keep`).
 */
async function openFile(
    model: Model<Types>,
    file: File,
    tabId: string,
    keep: (tabId: string, file: File) => void,
) {
    const name = file.name;
    const kind = kindOf(file);
    if (kind === "image") {
        keep(tabId, file);
        model.run("tab.set-component", { tabId, component: "image" });
        return;
    }
    if (kind === "other") {
        model.run("tab.set-component", {
            tabId,
            component: "info",
            data: { type: file.type, size: file.size },
        });
        return;
    }
    let text: string;
    try {
        text = await file.text();
    } catch {
        // the file went away after the drop (moved, deleted, no longer readable)
        model.run("tab.set-component", {
            tabId,
            component: "error",
            data: { message: "The file could not be read." },
        });
        return;
    }
    if (kind === "csv") {
        const csv = parseCsv(text);
        model.run("tab.set-component", {
            tabId,
            component: "table",
            data: { csv },
        });
        // the chart opens beside the table: an edge of its tabset splits it
        const tabset = model.get("node-parent-by", { nodeId: tabId });
        if (tabset && numericColumns(csv).length > 0) {
            model.run("tab.add", {
                component: "chart",
                label: `${name} chart`,
                data: { csv },
                to: tabset.id,
                location: "end",
            });
        }
        return;
    }
    // A layout from a file is untrusted JSON: `dispatch` validates it before it runs, so a broken
    // file is an error result, never a broken layout.
    let layout: unknown;
    try {
        layout = JSON.parse(text);
    } catch {
        layout = undefined;
    }
    const result =
        layout === undefined
            ? undefined
            : model.dispatch({ command: "layout.load", payload: { layout } });
    if (!result?.ok) {
        model.run("tab.set-component", {
            tabId,
            component: "error",
            data: {
                message: result
                    ? `Not a layout: ${result.error.message}`
                    : "Not valid JSON.",
            },
        });
    }
}

@Component({
    selector: "example-drop-files",
    imports: [
        DOCKABLE,
        LucideFolderOpen,
        CsvChart,
        CsvTable,
        ErrorNote,
        FileInfo,
        ImageViewer,
        Pending,
        Welcome,
    ],
    host: { class: "contents" },
    template: `
        <div [class]="styles.toolbar">
            <p [class]="styles.toolbarText">
                Drop a CSV, an image or a saved layout from your desktop.
            </p>
            <button type="button" [class]="styles.button" (click)="openSamples()">
                <svg lucideFolderOpen aria-hidden="true" [class]="styles.icon"></svg>
                Open sample files
            </button>
        </div>
        <div [class]="styles.frame">
            <div [dockableRoot]="model" [externalDrag]="externalDrag" [class]="styles.root">
                <div dockableRow>
                    <ng-template [dockableRowChild]="model" let-node>
                        @if (node.type === "row") {
                            <div [dockableRow]="node"></div>
                        } @else {
                            <div [dockableTabSet]="node" [class]="styles.tabset">
                                <div [class]="styles.strip">
                                    <div dockableTabList aria-label="Tabs" [class]="styles.tabList">
                                        <ng-template [dockableTabListItem]="model" let-tab>
                                            <div [dockableTab]="tab" [class]="styles.tab">
                                                <span [class]="styles.tabName">{{ tab.label }}</span>
                                            </div>
                                        </ng-template>
                                    </div>
                                </div>
                                <div dockableTabSetContent></div>
                            </div>
                        }
                    </ng-template>
                    <ng-template dockableRowSplitter let-node="node" let-index="index">
                        <div
                            [dockableSplitter]="node"
                            [index]="index"
                            aria-label="Resize"
                            [class]="styles.splitter"
                        >
                            <span aria-hidden="true" [class]="styles.splitterGrip"></span>
                        </div>
                    </ng-template>
                </div>
                <ng-template [dockablePanels]="model" let-tab>
                    <div [dockablePanel]="tab" [class]="styles.panel">
                        @switch (tab.component) {
                            @case ("table") {
                                <example-drop-files-table [csv]="tab.data.csv" />
                            }
                            @case ("chart") {
                                <example-drop-files-chart [csv]="tab.data.csv" />
                            }
                            @case ("image") {
                                <!-- an image tab whose File is gone (the page reloaded a saved
                                     layout) says so -->
                                @if (images().get(tab.id); as file) {
                                    <example-drop-files-image [file]="file" />
                                } @else {
                                    <example-drop-files-error
                                        message="The image is no longer open: drop it again."
                                    />
                                }
                            }
                            @case ("info") {
                                <example-drop-files-info [type]="tab.data.type" [size]="tab.data.size" />
                            }
                            @case ("error") {
                                <example-drop-files-error [message]="tab.data.message" />
                            }
                            @case ("pending") {
                                <example-drop-files-pending />
                            }
                            @case ("welcome") {
                                <example-drop-files-welcome />
                            }
                        }
                    </div>
                </ng-template>
                <!-- Where a file would land (a tabset, a tabset edge, the layout edge). -->
                <div
                    dockableDropIndicator
                    #indicator="dockableDropIndicator"
                    [class]="styles.dropIndicator(indicator.state())"
                ></div>
            </div>
        </div>
    `,
})
export default class DropFiles {
    protected readonly styles = styles;
    protected readonly model = createModel<Types>(json);
    /** a dropped image's File, by its tab id */
    protected readonly images = signal<ReadonlyMap<string, File>>(new Map());
    private readonly keep = (tabId: string, file: File) =>
        this.images.update((current) => new Map(current).set(tabId, file));

    /** Opens files into a tabset: one new tab each, selected, then filled once read. */
    private openInto(tabsetId: string, files: File[]) {
        for (const file of files) {
            const added = this.model.run("tab.add", {
                component: "pending",
                label: file.name,
                to: tabsetId,
                select: true,
            });
            if (added.ok) {
                void openFile(this.model, file, added.value.tabId, this.keep);
            }
        }
    }

    // Called when a drag that did not start in the page enters the layout. Browsers expose only
    // `dataTransfer.types` until the drop, so decide from the types and read the files on drop.
    // Returning undefined ignores the drag (text, links, …).
    protected readonly externalDrag: OnExternalDrag<Types> = (event) => {
        if (!event.dataTransfer?.types.includes("Files")) return undefined;
        return {
            // the tab the drop creates, wherever it lands; it becomes the first file's viewer
            tab: { component: "pending", label: "Opening…" },
            onDrop: (tabId, dropEvent) => {
                const [first, ...others] = Array.from(
                    dropEvent.dataTransfer?.files ?? [],
                );
                // no tab: the drop was refused (a rule or a middleware); no file: nothing to read
                if (!tabId || !first) return;
                this.model.run("tab.rename", { tabId, label: first.name });
                void openFile(this.model, first, tabId, this.keep);
                const tabset = this.model.get("node-parent-by", {
                    nodeId: tabId,
                });
                if (tabset) this.openInto(tabset.id, others);
            },
        };
    };

    protected openSamples() {
        const tabset = this.model.get("default-tabset");
        if (tabset) this.openInto(tabset.id, sampleFiles());
    }
}

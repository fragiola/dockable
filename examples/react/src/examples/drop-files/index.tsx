"use client";

import {
    createModel,
    type LayoutJson,
    type Model,
    type OnExternalDrag,
    type RowNode,
    type TabsetNode,
} from "@fragiola/dockable";
import { Dockable, type RowSplitterProps } from "@fragiola/dockable-react";
import { FolderOpen } from "lucide-react";
import { useState } from "react";
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
// page is an external drag: `onExternalDrag` on the root says whether to take it, and which tab
// the drop creates, where it lands (a tabset, its edge, the layout's edge). Once dropped, the app
// reads the file and turns that tab into the right viewer:
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
                location: "right",
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

export default function DropFiles() {
    const [model] = useState(() => createModel<Types>(json));
    const [images, setImages] = useState<ReadonlyMap<string, File>>(new Map());
    const keep = (tabId: string, file: File) =>
        setImages((current) => new Map(current).set(tabId, file));

    /** Opens files into a tabset: one new tab each, selected, then filled once read. */
    const openInto = (tabsetId: string, files: File[]) => {
        for (const file of files) {
            const added = model.run("tab.add", {
                component: "pending",
                label: file.name,
                to: tabsetId,
                select: true,
            });
            if (added.ok) void openFile(model, file, added.value.tabId, keep);
        }
    };

    // Called when a drag that did not start in the page enters the layout. Browsers expose only
    // `dataTransfer.types` until the drop, so decide from the types and read the files on drop.
    // Returning undefined ignores the drag (text, links, …).
    const onExternalDrag: OnExternalDrag<Types> = (event) => {
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
                model.run("tab.configure", { tabId, label: first.name });
                void openFile(model, first, tabId, keep);
                const tabset = model.get("node-parent-by", { nodeId: tabId });
                if (tabset) openInto(tabset.id, others);
            },
        };
    };

    const openSamples = () => {
        const tabset = model.get("default-tabset");
        if (tabset) openInto(tabset.id, sampleFiles());
    };

    return (
        <>
            <div className={styles.toolbar}>
                <p className={styles.toolbarText}>
                    Drop a CSV, an image or a saved layout from your desktop.
                </p>
                <button
                    type="button"
                    className={styles.button}
                    onClick={openSamples}
                >
                    <FolderOpen aria-hidden="true" className={styles.icon} />
                    Open sample files
                </button>
            </div>
            <div className={styles.frame}>
                <Dockable.Root
                    model={model}
                    onExternalDrag={onExternalDrag}
                    className={styles.root}
                >
                    <Dockable.Row<Types>
                        renderSplitter={(props) => <Splitter {...props} />}
                    >
                        {renderNode}
                    </Dockable.Row>
                    <Dockable.Panels<Types>>
                        {(tab) => (
                            <Dockable.Panel node={tab} className={styles.panel}>
                                {tab.component === "table" ? (
                                    <CsvTable csv={tab.data.csv} />
                                ) : tab.component === "chart" ? (
                                    <CsvChart csv={tab.data.csv} />
                                ) : tab.component === "image" ? (
                                    <ImageOf file={images.get(tab.id)} />
                                ) : tab.component === "info" ? (
                                    <FileInfo
                                        type={tab.data.type}
                                        size={tab.data.size}
                                    />
                                ) : tab.component === "error" ? (
                                    <ErrorNote message={tab.data.message} />
                                ) : tab.component === "pending" ? (
                                    <Pending />
                                ) : (
                                    <Welcome />
                                )}
                            </Dockable.Panel>
                        )}
                    </Dockable.Panels>
                    {/* Where a file would land (a tabset, a tabset edge, the layout edge). */}
                    <Dockable.DropIndicator className={styles.dropIndicator} />
                </Dockable.Root>
            </div>
        </>
    );
}

/** An image tab whose File is gone (the page reloaded a saved layout) says so. */
function ImageOf({ file }: { file: File | undefined }) {
    return file ? (
        <ImageViewer file={file} />
    ) : (
        <ErrorNote message="The image is no longer open: drop it again." />
    );
}

/** A row's child: a tabset, or a nested row rendered by this same function. */
function renderNode(node: TabsetNode<Types> | RowNode<Types>) {
    if (node.type === "row") {
        return (
            <Dockable.Row
                node={node}
                renderSplitter={(props) => <Splitter {...props} />}
            >
                {renderNode}
            </Dockable.Row>
        );
    }
    return <TabSet node={node} />;
}

/** A tabset: a card with the strip of tabs on top and the measured content area below. */
function TabSet({ node }: { node: TabsetNode<Types> }) {
    return (
        <Dockable.TabSet node={node} className={styles.tabset}>
            <div className={styles.strip}>
                <Dockable.TabList<Types>
                    aria-label="Tabs"
                    className={styles.tabList}
                >
                    {(tab) => (
                        <Dockable.Tab node={tab} className={styles.tab}>
                            <span className={styles.tabName}>{tab.label}</span>
                            {/* the active tabset's marker */}
                            <span
                                aria-hidden="true"
                                className={styles.tabMarker}
                            />
                        </Dockable.Tab>
                    )}
                </Dockable.TabList>
            </div>
            <Dockable.TabSetContent />
        </Dockable.TabSet>
    );
}

/** The bar between two children of a row, with a grip for the themes that show one. */
function Splitter(props: RowSplitterProps<Types>) {
    return (
        <Dockable.Splitter
            {...props}
            aria-label="Resize"
            className={styles.splitter}
        >
            <span aria-hidden="true" className={styles.splitterGrip} />
        </Dockable.Splitter>
    );
}

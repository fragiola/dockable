"use client";

import {
    createModel,
    type LayoutJson,
    type OnExternalDrag,
    type RowNode,
    type TabsetNode,
} from "@fragiola/dockable";
import { Dockable, type RowSplitterProps } from "@fragiola/dockable-react";
import { FileText, ImageIcon, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { PanelBody } from "../_kit/card";
import * as styles from "./styles";

// What the layout holds: hint tabs, and one tab per dropped file (its name in `data`).
type Types = { tabs: { hint: { name: string }; file: { name: string } } };

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 50,
                children: [{ component: "hint", data: { name: "Drop here" } }],
            },
            {
                type: "tabset",
                weight: 50,
                children: [{ component: "hint", data: { name: "Also here" } }],
            },
        ],
    },
};

/**
 * The dropped files, by tab id. A File is not JSON, so it stays out of the model (which only keeps
 * the tab's name and component); the tab's id is the key.
 */
type Files = ReadonlyMap<string, File>;

export default function DropFiles() {
    const [model] = useState(() => createModel<Types>(json));
    const [files, setFiles] = useState<Files>(new Map());

    // Called when a drag that did not start in the layout enters it. Browsers only
    // expose `dataTransfer.types` until the drop, so decide from the types and read the files in
    // onDrop. Returning undefined ignores the drag (text, links, …).
    const onExternalDrag: OnExternalDrag<Types> = (event) => {
        if (!event.dataTransfer?.types.includes("Files")) {
            return undefined;
        }
        return {
            // the tab the drop creates (a typed `tab.add` init); its name is replaced on drop,
            // once the file is readable
            tab: { component: "file", data: { name: "File" } },
            onDrop: (tab, dropEvent) => {
                const [first, ...others] = Array.from(
                    dropEvent.dataTransfer?.files ?? [],
                );
                if (!tab || !first) return; // refused (a drop rule or a middleware), or no file after all
                // the drop created one tab: name it after the first file (a command, so the
                // model's middleware sees it), and add one more tab beside it for every other file
                model.run("tab.update", {
                    tabId: tab,
                    component: "file",
                    data: { name: first.name },
                });
                const added = new Map([[tab, first]]);
                const container = model.get("node-parent-by", {
                    nodeId: tab,
                });
                for (const file of others) {
                    if (!container) break;
                    const next = model.run("tab.add", {
                        component: "file",
                        data: { name: file.name },
                        to: container.id,
                        location: "center",
                        index: -1,
                    });
                    if (next.ok) added.set(next.value.tabId, file);
                }
                setFiles((current) => new Map([...current, ...added]));
            },
        };
    };

    return (
        // The root needs a size: the wrapper gives it one, and the gutter around it.
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
                    {(tab) => {
                        const file = files.get(tab.id);
                        return (
                            <Dockable.Panel node={tab} className={styles.panel}>
                                {file ? <FileContent file={file} /> : <Hint />}
                            </Dockable.Panel>
                        );
                    }}
                </Dockable.Panels>
                {/* Where a file would land (a tabset, a tabset edge, the layout edge). */}
                <Dockable.DropIndicator
                    className={styles.dropIndicator}
                    style={(state) => ({
                        transitionDuration: `${state.tabDragSpeed}s`,
                    })}
                />
            </Dockable.Root>
        </div>
    );
}

function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function isText(file: File) {
    return (
        file.type.startsWith("text/") ||
        /\.(md|json|csv|ts|tsx|js|txt)$/i.test(file.name)
    );
}

function TextPreview({ file }: { file: File }) {
    const [text, setText] = useState<string | null>(null);
    useEffect(() => {
        let live = true;
        void file
            .text()
            .then((content) => live && setText(content.slice(0, 20_000)));
        return () => {
            live = false;
        };
    }, [file]);
    return (
        <pre data-testid="file-text" className={styles.textPreview}>
            {text ?? "Reading…"}
        </pre>
    );
}

function ImagePreview({ file }: { file: File }) {
    const [url, setUrl] = useState<string | null>(null);
    useEffect(() => {
        const objectUrl = URL.createObjectURL(file);
        setUrl(objectUrl);
        return () => URL.revokeObjectURL(objectUrl);
    }, [file]);
    return url ? (
        // a plain <img>: the source is a local object URL, which an image optimizer cannot fetch
        <img src={url} alt={file.name} className={styles.imagePreview} />
    ) : null;
}

function FileContent({ file }: { file: File }) {
    const Icon = file.type.startsWith("image/") ? ImageIcon : FileText;
    return (
        <PanelBody>
            <p className={styles.fileMeta}>
                <Icon aria-hidden className={styles.fileIcon} />
                {`${file.type || "unknown type"} · ${formatSize(file.size)}`}
            </p>
            {file.type.startsWith("image/") ? (
                <ImagePreview file={file} />
            ) : isText(file) ? (
                <TextPreview file={file} />
            ) : null}
        </PanelBody>
    );
}

function Hint() {
    return (
        <div className={styles.hint}>
            <div className={styles.hintCard}>
                <Upload aria-hidden className={styles.hintIcon} />
                <p>
                    Drag files from your computer onto any tabset, a tabset edge
                    or the layout edge. Each file opens as a tab where you drop
                    it.
                </p>
            </div>
        </div>
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
                            <span className={styles.tabName}>
                                {tab.data.name}
                            </span>
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

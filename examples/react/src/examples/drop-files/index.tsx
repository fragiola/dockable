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
import { cn } from "#/lib/cn";
import { PanelBody } from "../_kit/card";

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
                const container = model.get("node-parent-by-id", {
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
        // The root needs a size. Its row is `position: absolute; inset: 0`, so the gutter around
        // the layout goes on a wrapper: padding on the root would not move the row.
        <div className="flex min-h-0 flex-1 flex-col p-(--dk-gap)">
            <Dockable.Root
                model={model}
                onExternalDrag={onExternalDrag}
                className="palette-surface min-h-0 flex-1 bg-palette-base font-(family-name:--dk-font) text-palette-contrast"
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
                            <Dockable.Panel
                                node={tab}
                                // panels sit in a layer above the tabsets, whose overflow cannot
                                // clip them: the panel repeats the tabset's inner radius on its
                                // corners
                                className="palette-raised overflow-auto rounded-b-[max(0px,calc(var(--dk-radius)-var(--dk-border)))] bg-palette-base bg-(image:--dk-panel-texture) text-palette-contrast"
                            >
                                {file ? <FileContent file={file} /> : <Hint />}
                            </Dockable.Panel>
                        );
                    }}
                </Dockable.Panels>
                {/* Where a file would land (a tabset, a tabset edge, the layout edge). Panels are
                    portalled into the root after it, so it needs a stacking order to paint above
                    them. */}
                <Dockable.DropIndicator
                    className={(state) =>
                        cn(
                            "z-20 rounded-(--dk-radius) border-2 [border-style:var(--dk-indicator-style)] border-palette-base transition-[left,top,width,height]",
                            state.kind === "edge"
                                ? "palette-orange bg-palette-base/25"
                                : "palette-blue bg-palette-base/20",
                        )
                    }
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
        <pre
            data-testid="file-text"
            className="m-0 overflow-auto rounded-md bg-palette-soft p-3 font-mono text-xs whitespace-pre-wrap"
        >
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
        <img
            src={url}
            alt={file.name}
            className="max-h-full max-w-full rounded-md object-contain"
        />
    ) : null;
}

function FileContent({ file }: { file: File }) {
    const Icon = file.type.startsWith("image/") ? ImageIcon : FileText;
    return (
        <PanelBody>
            <p className="flex items-center gap-2 text-sm text-palette-accent/85">
                <Icon aria-hidden className="size-4" />
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
        <div className="grid h-full place-items-center p-6">
            <div className="flex max-w-xs flex-col items-center gap-3 rounded-(--dk-radius) border-2 border-dashed border-palette-line p-6 text-center text-palette-accent/85">
                <Upload aria-hidden className="size-8" />
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
        <Dockable.TabSet
            node={node}
            className="palette-raised rounded-(--dk-radius) border-(length:--dk-border) border-palette-line bg-palette-base text-palette-contrast shadow-(--dk-shadow) data-active:border-(--dk-tabset-active-line)"
        >
            <div className="flex min-h-(--dk-tab-height) items-stretch border-b border-palette-line">
                <Dockable.TabList<Types>
                    aria-label="Tabs"
                    // the start padding is load-bearing: a tab flush with the tabset's edge could
                    // not take a drop before it (that edge is the tabset's side drop)
                    className="flex min-w-0 flex-1 items-end gap-(--dk-tab-gap) overflow-hidden bg-(--dk-strip-bg) ps-[max(0.25rem,var(--dk-strip-padding))] pt-[calc(var(--dk-strip-padding)/2)]"
                >
                    {(tab) => (
                        <Dockable.Tab
                            node={tab}
                            className={cn(
                                "group/tab relative flex h-(--dk-tab-height) max-w-60 shrink-0 cursor-pointer select-none items-center gap-1.5 px-3",
                                "rounded-t-(--dk-tab-radius) font-(family-name:--dk-tab-font) text-(length:--dk-tab-size) text-palette-accent/85",
                                "border-e-(length:--dk-tab-divider) border-palette-line outline-none transition-colors duration-(--dk-motion) hover:bg-palette-soft",
                                "focus-visible:ring-2 focus-visible:ring-palette-ring focus-visible:ring-inset",
                                "data-selected:bg-(--dk-tab-selected-bg) data-selected:text-(--dk-tab-selected-fg) data-dragging:opacity-40",
                            )}
                        >
                            <span className="truncate">{tab.data.name}</span>
                            {/* the active tabset's marker: `in-data-active:` reads the enclosing
                                TabSet's data-active, `group-data-selected/tab:` this tab's */}
                            <span
                                aria-hidden="true"
                                className="palette-blue pointer-events-none absolute inset-x-2 bottom-0 hidden h-0.5 rounded-full bg-palette-base in-data-active:group-data-selected/tab:[display:var(--dk-tab-marker)]"
                            />
                        </Dockable.Tab>
                    )}
                </Dockable.TabList>
            </div>
            <Dockable.TabSetContent />
        </Dockable.TabSet>
    );
}

/**
 * The bar between two children of a row: `--dk-splitter-size` thick (the engine measures it), with
 * a wider grab area (`::after`) and a grip for the themes that show one (`--dk-grip`).
 */
function Splitter(props: RowSplitterProps<Types>) {
    return (
        <Dockable.Splitter
            {...props}
            aria-label="Resize"
            className={cn(
                "group/splitter relative z-10 flex shrink-0 items-center justify-center bg-(--dk-splitter-bg) outline-none",
                "after:absolute after:transition-colors after:duration-(--dk-motion)",
                "hover:after:bg-palette-ring/30 data-dragging:after:bg-palette-ring/60 focus-visible:after:bg-palette-ring/60",
                // side by side: a vertical bar
                "data-[orientation=vertical]:w-(--dk-splitter-size) data-[orientation=vertical]:cursor-ew-resize",
                "data-[orientation=vertical]:after:inset-y-0 data-[orientation=vertical]:after:start-1/2",
                "data-[orientation=vertical]:after:w-(--dk-splitter-grab) data-[orientation=vertical]:after:-translate-x-1/2",
                "rtl:data-[orientation=vertical]:after:translate-x-1/2",
                // stacked: a horizontal bar
                "data-[orientation=horizontal]:h-(--dk-splitter-size) data-[orientation=horizontal]:cursor-ns-resize",
                "data-[orientation=horizontal]:after:inset-x-0 data-[orientation=horizontal]:after:top-1/2",
                "data-[orientation=horizontal]:after:h-(--dk-splitter-grab) data-[orientation=horizontal]:after:-translate-y-1/2",
            )}
        >
            <span
                aria-hidden="true"
                className={cn(
                    "pointer-events-none [display:var(--dk-grip)] rounded-full bg-palette-line",
                    "group-data-[orientation=vertical]/splitter:h-8 group-data-[orientation=vertical]/splitter:w-1",
                    "group-data-[orientation=horizontal]/splitter:h-1 group-data-[orientation=horizontal]/splitter:w-8",
                )}
            />
        </Dockable.Splitter>
    );
}

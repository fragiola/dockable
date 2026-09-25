"use client";

import {
    Actions,
    DockLocation,
    type IExternalDrag,
    type IJsonModel,
    LayoutEngine,
    Model,
} from "@fragiola/dockable";
import { FileText, ImageIcon, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { PanelBody } from "../_kit/card";
import { DockLayout } from "../_kit/layout";

const json: IJsonModel = {
    global: {},
    borders: [],
    layout: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 50,
                children: [
                    { type: "tab", name: "Drop here", component: "hint" },
                ],
            },
            {
                type: "tabset",
                weight: 50,
                children: [
                    { type: "tab", name: "Also here", component: "hint" },
                ],
            },
        ],
    },
};

/**
 * The dropped files, by tab id. A File is not JSON, so it stays out of the model (which only keeps
 * the tab's name and component); the tab's id is the key.
 */
type Files = ReadonlyMap<string, File>;

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

export default function DropFiles() {
    const [model] = useState(() => Model.fromJson(json));
    const [files, setFiles] = useState<Files>(new Map());

    // Called when a drag that did not start in the layout enters it. Browsers only
    // expose `dataTransfer.types` until the drop, so decide from the types and read the files in
    // onDrop. Returning undefined ignores the drag (text, links, …).
    const onExternalDrag = (event: {
        dataTransfer: DataTransfer | null;
    }): IExternalDrag | undefined => {
        if (!event.dataTransfer?.types.includes("Files")) {
            return undefined;
        }
        return {
            // the name is replaced on drop, once the file is readable
            json: { type: "tab", name: "File", component: "file" },
            onDrop: (tab, dropEvent) => {
                const [first, ...others] = Array.from(
                    dropEvent.dataTransfer?.files ?? [],
                );
                const engine = LayoutEngine.of(model);
                if (!tab || !first || !engine) return; // vetoed by onAction, or no file after all
                // the drop created one tab: name it after the first file (through the engine, so
                // onAction sees it), and add one more tab beside it for every other file
                engine.doAction(Actions.renameTab(tab.getId(), first.name));
                const added = new Map([[tab.getId(), first]]);
                const tabset = tab.getParent();
                for (const file of others) {
                    if (!tabset) break;
                    const next = engine.doAction(
                        Actions.addTab(
                            { type: "tab", name: file.name, component: "file" },
                            tabset.getId(),
                            DockLocation.CENTER,
                            -1,
                        ),
                    );
                    if (next) added.set(next.getId(), file);
                }
                setFiles((current) => new Map([...current, ...added]));
            },
        };
    };

    return (
        <DockLayout
            model={model}
            rootProps={{ onExternalDrag }}
            renderContent={(tab) => {
                const file = files.get(tab.getId());
                return file ? <FileContent file={file} /> : <Hint />;
            }}
        />
    );
}

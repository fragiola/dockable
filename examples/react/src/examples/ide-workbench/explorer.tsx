"use client";

import { type Model, useModelState } from "@fragiola/dockable-react";
import {
    ChevronRight,
    FileCode2,
    FileJson,
    FileText,
    Hash,
    RotateCcw,
} from "lucide-react";
import { useState } from "react";
import { FILE_PATHS, fileName, folderOf } from "./files";
import * as styles from "./styles";
import { activePath, dirtyPaths, type Types } from "./workspace";

// The file tree. It is the content of the start border's "Explorer" tab, and opens files through
// the callback it is given (the example turns that into the `tab.add` / `tab.select` commands).

/** A file type: its icon, and the tone that colours it. */
type FileType = [typeof FileCode2, styles.FileTone];

/** A file icon, coloured by type through a palette (so every theme recolours it). */
export function FileIcon({
    path,
    className,
}: {
    path: string;
    className?: string;
}) {
    const [Icon, tone]: FileType = path.endsWith(".json")
        ? [FileJson, "orange"]
        : path.endsWith(".md")
          ? [FileText, "green"]
          : path.endsWith(".css")
            ? [Hash, "purple"]
            : [FileCode2, "blue"];
    return (
        <Icon aria-hidden="true" className={styles.fileIcon(tone, className)} />
    );
}

export function Explorer({
    model,
    onOpen,
    onResetLayout,
}: {
    model: Model<Types>;
    onOpen: (path: string) => void;
    onResetLayout: () => void;
}) {
    const dirty = useModelState(() => dirtyPaths(model), { model });
    const active = useModelState(() => activePath(model), { model });
    const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
    const folders = [...new Set(FILE_PATHS.map(folderOf))];

    const toggle = (folder: string) =>
        setCollapsed((current) => {
            const next = new Set(current);
            if (next.has(folder)) next.delete(folder);
            else next.add(folder);
            return next;
        });

    return (
        <nav aria-label="Explorer" className={styles.explorer}>
            <div className={styles.explorerHeader}>
                Explorer
                <button
                    type="button"
                    aria-label="Reset the saved layout"
                    title="Reset the saved layout"
                    onClick={onResetLayout}
                    className={styles.resetButton}
                >
                    <RotateCcw
                        aria-hidden="true"
                        className={styles.resetIcon}
                    />
                </button>
            </div>
            <ul className={styles.explorerTree}>
                {folders.map((folder) => {
                    const files = FILE_PATHS.filter(
                        (path) => folderOf(path) === folder,
                    );
                    const open = !collapsed.has(folder);
                    return (
                        <li key={folder || "/"}>
                            {folder ? (
                                <button
                                    type="button"
                                    aria-expanded={open}
                                    onClick={() => toggle(folder)}
                                    className={styles.folderRow}
                                >
                                    <ChevronRight
                                        aria-hidden="true"
                                        className={styles.folderChevron(open)}
                                    />
                                    {folder}
                                </button>
                            ) : null}
                            {open ? (
                                <ul>
                                    {files.map((path) => (
                                        <li key={path}>
                                            <button
                                                type="button"
                                                data-testid="explorer-file"
                                                aria-current={
                                                    path === active
                                                        ? "true"
                                                        : undefined
                                                }
                                                onClick={() => onOpen(path)}
                                                className={styles.fileRow(
                                                    Boolean(folder),
                                                )}
                                            >
                                                <FileIcon path={path} />
                                                <span
                                                    className={styles.fileName}
                                                >
                                                    {fileName(path)}
                                                </span>
                                                {dirty.has(path) ? (
                                                    <span
                                                        role="img"
                                                        aria-label="modified"
                                                        className={
                                                            styles.fileModified
                                                        }
                                                    />
                                                ) : null}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            ) : null}
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}

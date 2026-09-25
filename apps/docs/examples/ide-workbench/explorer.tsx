"use client";

import {
    ChevronRight,
    FileCode2,
    FileJson,
    FileText,
    Hash,
    RotateCcw,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { FILE_PATHS, fileName, folderOf } from "./files";

// The file tree. It lives OUTSIDE the layout: a plain sidebar that opens files through the
// callback it is given (the example turns that into `Actions.addTab` / `Actions.selectTab`).

/** A file icon, coloured by type through a palette (so every theme recolours it). */
export function FileIcon({
    path,
    className,
}: {
    path: string;
    className?: string;
}) {
    const [Icon, palette] = path.endsWith(".json")
        ? [FileJson, "palette-orange"]
        : path.endsWith(".md")
          ? [FileText, "palette-green"]
          : path.endsWith(".css")
            ? [Hash, "palette-purple"]
            : [FileCode2, "palette-blue"];
    return (
        <Icon
            aria-hidden="true"
            className={cn(
                palette,
                "size-3.5 shrink-0 text-palette-accent",
                className,
            )}
        />
    );
}

const row = [
    "flex h-6 w-full items-center gap-1.5 pe-2 text-start text-[13px] outline-none",
    "text-palette-accent/85 hover:bg-palette-soft hover:text-palette-contrast",
    "focus-visible:ring-1 focus-visible:ring-palette-ring focus-visible:ring-inset",
].join(" ");

export function Explorer({
    activePath,
    dirtyPaths,
    onOpen,
    onResetLayout,
}: {
    activePath: string | undefined;
    dirtyPaths: ReadonlySet<string>;
    onOpen: (path: string) => void;
    onResetLayout: () => void;
}) {
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
        <nav
            aria-label="Explorer"
            className="palette-surface flex w-52 shrink-0 flex-col border-e border-palette-line bg-palette-base text-palette-contrast max-sm:hidden"
        >
            <div className="flex h-(--dk-tab-height) min-h-8 items-center justify-between ps-3 pe-1 text-[11px] font-semibold tracking-wider text-palette-accent/85 uppercase">
                Explorer
                <button
                    type="button"
                    aria-label="Reset the saved layout"
                    title="Reset the saved layout"
                    onClick={onResetLayout}
                    className="grid size-6 place-items-center rounded-sm outline-none hover:bg-palette-soft hover:text-palette-contrast focus-visible:ring-1 focus-visible:ring-palette-ring"
                >
                    <RotateCcw aria-hidden="true" className="size-3.5" />
                </button>
            </div>
            <ul className="min-h-0 flex-1 overflow-auto pb-2">
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
                                    className={cn(row, "ps-2")}
                                >
                                    <ChevronRight
                                        aria-hidden="true"
                                        className={cn(
                                            "size-3.5 shrink-0 transition-transform rtl:-scale-x-100",
                                            open && "rotate-90 rtl:-rotate-90",
                                        )}
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
                                                    path === activePath
                                                        ? "true"
                                                        : undefined
                                                }
                                                onClick={() => onOpen(path)}
                                                className={cn(
                                                    row,
                                                    folder ? "ps-7" : "ps-3",
                                                    "aria-[current]:bg-palette-soft aria-[current]:text-palette-contrast",
                                                )}
                                            >
                                                <FileIcon path={path} />
                                                <span className="truncate">
                                                    {fileName(path)}
                                                </span>
                                                {dirtyPaths.has(path) ? (
                                                    <span
                                                        role="img"
                                                        aria-label="modified"
                                                        className="ms-auto size-2 shrink-0 rounded-full bg-palette-accent"
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

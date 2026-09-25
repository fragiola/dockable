"use client";

import { Check, Copy, X } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export interface SourceFile {
    /** the path shown to the reader, relative to examples/ */
    path: string;
    /** the raw source, for copying */
    code: string;
    /** the highlighted source, rendered on the server */
    highlighted: ReactNode;
}

/** Copies text and reports it through `data-copied` for a moment (no toast library). */
function useCopy() {
    const [copied, setCopied] = useState<string | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    useEffect(() => () => clearTimeout(timer.current), []);
    const copy = async (key: string, text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(key);
            clearTimeout(timer.current);
            timer.current = setTimeout(() => setCopied(null), 1500);
        } catch {
            // clipboard unavailable (permissions, insecure context): nothing to report
        }
    };
    return { copied, copy };
}

const toolButton =
    "inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-palette-accent/85 outline-none hover:bg-palette-soft hover:text-palette-contrast focus-visible:ring-2 focus-visible:ring-palette-ring data-copied:text-palette-contrast";

/**
 * The code panel: one tab per file of the example (the real, compiled files), a copy button per
 * file, and "Copy all" with a `// <path>` header per file. `setup` lists what to install.
 */
export function CodePanel({
    files,
    setup,
    onClose,
}: {
    files: SourceFile[];
    setup: string;
    onClose: () => void;
}) {
    const [active, setActive] = useState(0);
    const { copied, copy } = useCopy();
    const id = useId();
    const current = files[Math.min(active, files.length - 1)];
    const all = files
        .map((file) => `// ${file.path}\n${file.code.trimEnd()}\n`)
        .join("\n");

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="flex items-center gap-1 border-b border-palette-line px-2 py-1.5">
                <h2 className="px-1 text-sm font-semibold">Code</h2>
                <div className="ms-auto flex items-center gap-1">
                    <button
                        type="button"
                        data-testid="copy-all"
                        data-copied={copied === "all" ? "" : undefined}
                        className={toolButton}
                        onClick={() => copy("all", all)}
                    >
                        {copied === "all" ? (
                            <Check aria-hidden className="size-3.5" />
                        ) : (
                            <Copy aria-hidden className="size-3.5" />
                        )}
                        {copied === "all" ? "Copied" : "Copy all"}
                    </button>
                    <button
                        type="button"
                        aria-label="Close code"
                        className={toolButton}
                        onClick={onClose}
                    >
                        <X aria-hidden className="size-4" />
                    </button>
                </div>
            </div>
            <div className="border-b border-palette-line px-3 py-2 text-xs text-palette-accent/85">
                <p className="mb-1">Install</p>
                <code className="block overflow-x-auto whitespace-pre rounded bg-palette-soft px-2 py-1.5 font-mono text-palette-contrast">
                    {setup}
                </code>
            </div>
            <div
                role="tablist"
                aria-label="Files"
                className="flex shrink-0 gap-0.5 overflow-x-auto border-b border-palette-line px-2 pt-1.5"
            >
                {files.map((file, index) => (
                    <button
                        key={file.path}
                        type="button"
                        role="tab"
                        id={`${id}-tab-${index}`}
                        aria-selected={index === active}
                        aria-controls={`${id}-panel`}
                        className="shrink-0 rounded-t-md px-2.5 py-1.5 font-mono text-xs text-palette-accent/85 outline-none hover:bg-palette-soft aria-selected:bg-palette-soft aria-selected:text-palette-contrast focus-visible:ring-2 focus-visible:ring-palette-ring"
                        onClick={() => setActive(index)}
                    >
                        {file.path}
                    </button>
                ))}
            </div>
            {current ? (
                <div
                    role="tabpanel"
                    id={`${id}-panel`}
                    aria-labelledby={`${id}-tab-${active}`}
                    className="relative min-h-0 flex-1 overflow-auto"
                >
                    <button
                        type="button"
                        data-testid="copy-file"
                        data-copied={copied === current.path ? "" : undefined}
                        className={cn(
                            toolButton,
                            "palette-raised absolute end-3 top-3 z-10 border border-palette-line bg-palette-base",
                        )}
                        onClick={() => copy(current.path, current.code)}
                    >
                        {copied === current.path ? (
                            <Check aria-hidden className="size-3.5" />
                        ) : (
                            <Copy aria-hidden className="size-3.5" />
                        )}
                        {copied === current.path ? "Copied" : "Copy"}
                    </button>
                    <div
                        data-testid="code-file"
                        data-path={current.path}
                        className="text-[13px] [&_figure]:my-0 [&_figure]:rounded-none [&_figure]:border-0 [&_figure]:shadow-none"
                    >
                        {current.highlighted}
                    </div>
                </div>
            ) : null}
        </div>
    );
}

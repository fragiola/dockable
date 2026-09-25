"use client";

import { Actions, type TabNode } from "@fragiola/dockable";
import { useDockable } from "@fragiola/dockable-react";
import { CircleAlert, TriangleAlert } from "lucide-react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { FILE_PATHS, PROBLEMS } from "./files";
import type { EditorConfig, Workspace } from "./workspace";

// The content of each kind of tab. Panels are never remounted when their tab moves, so the
// editor keeps its text, caret and scroll through any drag.

/**
 * A plain-text editor. It reports "modified" to its TAB: the dirty flag goes into the tab's
 * `config` through `Actions.updateNodeAttributes`, and the tab reads it back (`data-dirty`).
 * The text itself stays in the workspace, outside the model.
 */
export function EditorPanel({
    tab,
    workspace,
}: {
    tab: TabNode;
    workspace: Workspace;
}) {
    const { engine } = useDockable();
    const config = tab.getConfig() as EditorConfig;
    const { path } = config;
    const [text, setText] = useState(() => workspace.read(path));
    const [, setSaves] = useState(0);
    const dirty = workspace.isDirty(path);

    useEffect(() => {
        if (Boolean(config.dirty) !== dirty) {
            engine.doAction(
                Actions.updateNodeAttributes(tab.getId(), {
                    config: { ...config, dirty },
                }),
            );
        }
    }, [engine, tab, config, dirty]);

    const save = () => {
        workspace.save(path);
        setSaves((n) => n + 1);
    };
    const onKeyDown = (event: KeyboardEvent) => {
        if ((event.ctrlKey || event.metaKey) && event.key === "s") {
            event.preventDefault();
            save();
        }
    };
    const lines = text.split("\n").length;

    return (
        <div className="flex h-full flex-col">
            <div className="flex h-7 shrink-0 items-center gap-1 border-b border-palette-line ps-3 pe-1 text-xs text-palette-accent/85">
                {path.split("/").map((part, index, parts) => (
                    <span key={part} className="flex items-center gap-1">
                        {index > 0 ? <span aria-hidden="true">›</span> : null}
                        <span
                            className={cn(
                                index === parts.length - 1 &&
                                    "text-palette-contrast",
                            )}
                        >
                            {part}
                        </span>
                    </span>
                ))}
                <button
                    type="button"
                    onClick={save}
                    disabled={!dirty}
                    className="ms-auto h-5 rounded-sm px-2 outline-none hover:bg-palette-soft hover:text-palette-contrast focus-visible:ring-1 focus-visible:ring-palette-ring disabled:opacity-50"
                >
                    {dirty ? "Save" : "Saved"}
                </button>
            </div>
            <div className="flex min-h-0 flex-1 overflow-auto font-mono text-[13px] leading-5">
                <pre
                    aria-hidden="true"
                    className="sticky start-0 m-0 shrink-0 bg-palette-base py-2 ps-4 pe-3 text-end text-palette-accent/60 select-none"
                >
                    {Array.from({ length: lines }, (_, i) => i + 1).join("\n")}
                </pre>
                <textarea
                    aria-label={`Contents of ${path}`}
                    data-testid="editor"
                    value={text}
                    wrap="off"
                    spellCheck={false}
                    onChange={(event) => {
                        setText(event.target.value);
                        workspace.write(path, event.target.value);
                    }}
                    onKeyDown={onKeyDown}
                    className="min-h-full min-w-0 flex-1 resize-none bg-transparent py-2 pe-4 whitespace-pre text-palette-contrast outline-none [field-sizing:content]"
                />
            </div>
        </div>
    );
}

/** A small shell: enough commands to feel like one. */
export function TerminalPanel({ workspace }: { workspace: Workspace }) {
    const [lines, setLines] = useState<string[]>([
        "Welcome to the workbench terminal. Type `help`.",
    ]);
    const [input, setInput] = useState("");
    const end = useRef<HTMLDivElement | null>(null);

    // biome-ignore lint/correctness/useExhaustiveDependencies: scroll when a line is added
    useEffect(() => {
        end.current?.scrollIntoView({ block: "nearest" });
    }, [lines]);

    const run = (command: string) => {
        const [name, ...args] = command.trim().split(/\s+/);
        const out: Record<string, () => string[]> = {
            help: () => ["commands: ls, cat <file>, git status, clear"],
            ls: () => FILE_PATHS,
            cat: () => workspace.read(args[0] ?? "").split("\n"),
            git: () => {
                const modified = FILE_PATHS.filter(workspace.isDirty);
                return modified.length > 0
                    ? modified.map((path) => `  modified:   ${path}`)
                    : ["nothing to commit, working tree clean"];
            },
        };
        if (name === "clear") {
            setLines([]);
            return;
        }
        const result = name
            ? (out[name]?.() ?? [`${name}: command not found`])
            : [];
        setLines((current) =>
            [...current, `$ ${command}`, ...result].slice(-500),
        );
    };

    return (
        <div className="flex min-h-full flex-col p-2 font-mono text-xs leading-5">
            {lines.map((line, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: an append-only log
                <div key={index} className="whitespace-pre-wrap">
                    {line}
                </div>
            ))}
            <form
                className="flex items-center gap-2"
                onSubmit={(event) => {
                    event.preventDefault();
                    run(input);
                    setInput("");
                }}
            >
                <span aria-hidden="true" className="text-palette-accent/85">
                    ~/counter-app $
                </span>
                <input
                    aria-label="Terminal command"
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    spellCheck={false}
                    className="min-w-0 flex-1 bg-transparent outline-none"
                />
            </form>
            <div ref={end} />
        </div>
    );
}

/** The linter's findings; clicking one opens its file. */
export function ProblemsPanel({ onOpen }: { onOpen: (path: string) => void }) {
    return (
        <ul className="py-1 text-[13px]">
            {PROBLEMS.map((problem) => {
                const Icon =
                    problem.severity === "error" ? CircleAlert : TriangleAlert;
                return (
                    <li key={`${problem.path}:${problem.line}`}>
                        <button
                            type="button"
                            onClick={() => onOpen(problem.path)}
                            className="flex w-full items-center gap-2 px-3 py-1 text-start outline-none hover:bg-palette-soft focus-visible:ring-1 focus-visible:ring-palette-ring focus-visible:ring-inset"
                        >
                            <Icon
                                aria-label={problem.severity}
                                className={cn(
                                    problem.severity === "error"
                                        ? "palette-danger"
                                        : "palette-orange",
                                    "size-3.5 shrink-0 text-palette-accent",
                                )}
                            />
                            <span className="truncate">{problem.message}</span>
                            <span className="ms-auto shrink-0 text-xs text-palette-accent/85">
                                {`${problem.path}:${problem.line}`}
                            </span>
                        </button>
                    </li>
                );
            })}
        </ul>
    );
}

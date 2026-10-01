"use client";

import type { TabNode } from "@fragiola/dockable";
import { useDockable } from "@fragiola/dockable-react";
import { CircleAlert, TriangleAlert } from "lucide-react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { FILE_PATHS, PROBLEMS } from "./files";
import * as styles from "./styles";
import type { EditorData, Types, Workspace } from "./workspace";

// The content of each kind of tab. Panels are never remounted when their tab moves, so the
// editor keeps its text, caret and scroll through any drag.

/**
 * A plain-text editor. It reports "modified" to its TAB: the dirty flag goes into the tab's
 * `data` through the `tab.update` command, and the tab reads it back (`data-dirty`).
 * The text itself stays in the workspace, outside the model.
 */
export function EditorPanel({
    tab,
    workspace,
}: {
    // an editor tab: `tab.data` is typed as the editor's data, no cast
    tab: TabNode<"editor", EditorData>;
    workspace: Workspace;
}) {
    const { model } = useDockable<Types>();
    const { id, data } = tab;
    const { path } = data;
    const [text, setText] = useState(() => workspace.read(path));
    const [, setSaves] = useState(0);
    const dirty = workspace.isDirty(path);

    useEffect(() => {
        if (Boolean(data.dirty) !== dirty) {
            // `data` is replaced whole: keep the rest of it
            model.run("tab.update", {
                tabId: id,
                component: "editor",
                data: { ...data, dirty },
            });
        }
    }, [model, id, data, dirty]);

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
        <div className={styles.editor}>
            <div className={styles.breadcrumbs}>
                {path.split("/").map((part, index, parts) => (
                    <span key={part} className={styles.crumb}>
                        {index > 0 ? <span aria-hidden="true">›</span> : null}
                        <span
                            className={styles.crumbName(
                                index === parts.length - 1,
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
                    className={styles.editorSave}
                >
                    {dirty ? "Save" : "Saved"}
                </button>
            </div>
            <div className={styles.editorBody}>
                <pre aria-hidden="true" className={styles.lineNumbers}>
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
                    className={styles.editorText}
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
        <div className={styles.terminal}>
            {lines.map((line, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: an append-only log
                <div key={index} className={styles.terminalLine}>
                    {line}
                </div>
            ))}
            <form
                className={styles.terminalForm}
                onSubmit={(event) => {
                    event.preventDefault();
                    run(input);
                    setInput("");
                }}
            >
                <span aria-hidden="true" className={styles.terminalPrompt}>
                    ~/counter-app $
                </span>
                <input
                    aria-label="Terminal command"
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    spellCheck={false}
                    className={styles.terminalInput}
                />
            </form>
            <div ref={end} />
        </div>
    );
}

/** The linter's findings; clicking one opens its file. */
export function ProblemsPanel({ onOpen }: { onOpen: (path: string) => void }) {
    return (
        <ul className={styles.problems}>
            {PROBLEMS.map((problem) => {
                const Icon =
                    problem.severity === "error" ? CircleAlert : TriangleAlert;
                return (
                    <li key={`${problem.path}:${problem.line}`}>
                        <button
                            type="button"
                            onClick={() => onOpen(problem.path)}
                            className={styles.problem}
                        >
                            <Icon
                                aria-label={problem.severity}
                                className={styles.problemIcon(problem.severity)}
                            />
                            <span className={styles.problemMessage}>
                                {problem.message}
                            </span>
                            <span className={styles.problemLocation}>
                                {`${problem.path}:${problem.line}`}
                            </span>
                        </button>
                    </li>
                );
            })}
        </ul>
    );
}

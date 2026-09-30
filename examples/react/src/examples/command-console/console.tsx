"use client";

import type {
    AnyTypes,
    CommandResult,
    DockableTypes,
    Model,
} from "@fragiola/dockable";
import { useEffect, useId, useState } from "react";
import { cn } from "#/lib/cn";
import * as styles from "../_kit/styles";
import { fieldsOf, fromToolCall, toolName, toTools } from "./tools";

// The console lives outside the layout and talks to the model only: `commands()` to list what it
// can do, `dispatch` to run a command given as JSON (validated like any untrusted input), and
// `subscribe` to log every change, whoever made it (the console, a drag, a click).

const SAMPLES = [
    {
        label: "Select",
        input: { command: "tab.select", payload: { tab: "todo" } },
    },
    {
        label: "Move",
        input: { command: "tab.move", payload: { tab: "ideas", to: "left" } },
    },
    {
        label: "Add",
        input: {
            command: "tab.add",
            payload: {
                component: "note",
                data: { name: "Draft", text: "Added from JSON." },
                to: "left",
            },
        },
    },
    {
        label: "Invalid",
        input: { command: "tab.move", payload: { tab: 3 } },
    },
] as const;

type View = "console" | "commands" | "tools";

interface LogEntry {
    id: number;
    command: string;
    payload: string;
    transient: boolean;
}

/** Every commit, newest first: a gesture's transient steps and its last command are one line. */
function useCommandLog<T extends DockableTypes>(model: Model<T>): LogEntry[] {
    const [log, setLog] = useState<LogEntry[]>([]);
    useEffect(() => {
        let next = 0;
        return model.subscribe((event) => {
            setLog((entries) => {
                const entry: LogEntry = {
                    id: next++,
                    command: event.command,
                    payload: JSON.stringify(event.payload),
                    transient: event.transient,
                };
                const [latest, ...rest] = entries;
                // a drag's steps (and the command that ends it) replace its line
                return latest?.transient && latest.command === entry.command
                    ? [entry, ...rest]
                    : [entry, ...entries].slice(0, 20);
            });
        });
    }, [model]);
    return log;
}

export function CommandConsole<T extends DockableTypes = AnyTypes>({
    model,
}: {
    model: Model<T>;
}) {
    const [view, setView] = useState<View>("console");
    // the log lives here, so it keeps every change while the other views are shown
    const log = useCommandLog(model);
    return (
        <section
            aria-label="Command console"
            className="palette-surface flex min-h-0 shrink-0 flex-col border-palette-line bg-palette-base max-md:h-72 max-md:border-t md:w-80 md:border-s"
        >
            <div className="flex h-11 shrink-0 items-center gap-1 border-b border-palette-line px-2">
                {(
                    [
                        ["console", "Console"],
                        ["commands", "Commands"],
                        ["tools", "As AI tools"],
                    ] as const
                ).map(([value, label]) => (
                    <button
                        key={value}
                        type="button"
                        aria-pressed={view === value}
                        onClick={() => setView(value)}
                        className={cn(
                            styles.button,
                            "h-7 px-2 text-xs aria-pressed:bg-palette-soft aria-pressed:text-palette-contrast",
                        )}
                    >
                        {label}
                    </button>
                ))}
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
                {view === "console" ? (
                    <ConsoleView model={model} log={log} />
                ) : view === "commands" ? (
                    <CommandList model={model} />
                ) : (
                    <ToolsView model={model} />
                )}
            </div>
        </section>
    );
}

function ConsoleView<T extends DockableTypes>({
    model,
    log,
}: {
    model: Model<T>;
    /** every commit, from the console or from the layout itself */
    log: readonly LogEntry[];
}) {
    const [input, setInput] = useState(() =>
        JSON.stringify(SAMPLES[0].input, null, 2),
    );
    const [result, setResult] = useState<CommandResult<unknown> | null>(null);
    const [parseError, setParseError] = useState<string | null>(null);
    const inputId = useId();

    const run = () => {
        let parsed: unknown;
        try {
            parsed = JSON.parse(input);
        } catch (caught) {
            setParseError(
                caught instanceof Error ? caught.message : String(caught),
            );
            setResult(null);
            return;
        }
        setParseError(null);
        // untrusted JSON: dispatch validates the command name and the payload, and never throws
        setResult(model.dispatch(parsed));
    };

    return (
        <div className="flex flex-col gap-3 p-3 text-sm">
            <div className="flex flex-wrap gap-1">
                {SAMPLES.map((sample) => (
                    <button
                        key={sample.label}
                        type="button"
                        onClick={() =>
                            setInput(JSON.stringify(sample.input, null, 2))
                        }
                        className={cn(styles.button, "h-7 px-2 text-xs")}
                    >
                        {sample.label}
                    </button>
                ))}
            </div>
            <label htmlFor={inputId} className="text-xs font-semibold">
                Command (JSON)
            </label>
            <textarea
                id={inputId}
                data-testid="command-input"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                spellCheck={false}
                rows={6}
                className="resize-y rounded-md border border-palette-line bg-palette-soft p-2 font-mono text-xs leading-5 text-palette-contrast outline-none focus-visible:ring-2 focus-visible:ring-palette-ring"
            />
            <button
                type="button"
                onClick={run}
                className={cn(
                    "palette-blue",
                    styles.solidButton,
                    "h-8 self-start px-3",
                )}
            >
                Run
            </button>
            <output data-testid="result" aria-live="polite" className="block">
                {parseError ? (
                    <ErrorBox
                        code="parse"
                        message={parseError}
                        path={undefined}
                        issues={[]}
                    />
                ) : result === null ? null : result.ok ? (
                    <div className="palette-green rounded-md border border-palette-line bg-palette-soft p-2">
                        <p className="text-xs font-semibold">ok</p>
                        <pre className="font-mono text-xs whitespace-pre-wrap">
                            {JSON.stringify(result.value, null, 2)}
                        </pre>
                    </div>
                ) : (
                    <ErrorBox
                        code={result.error.code}
                        message={result.error.message}
                        path={result.error.path}
                        issues={result.error.issues ?? []}
                    />
                )}
            </output>
            <div>
                <h3 className="mb-1 text-xs font-semibold">
                    Log (model.subscribe)
                </h3>
                <ol data-testid="log" className="flex flex-col gap-1">
                    {log.map((entry) => (
                        <li
                            key={entry.id}
                            className="truncate font-mono text-xs text-palette-accent"
                        >
                            <span className="text-palette-contrast">
                                {entry.command}
                            </span>{" "}
                            {entry.transient ? "(transient) " : ""}
                            {entry.payload}
                        </li>
                    ))}
                </ol>
            </div>
        </div>
    );
}

function ErrorBox({
    code,
    message,
    path,
    issues,
}: {
    code: string;
    message: string;
    path: string | undefined;
    issues: readonly { path: string; message: string }[];
}) {
    return (
        <div
            role="alert"
            className="palette-danger rounded-md border border-palette-line bg-palette-soft p-2 text-xs text-palette-accent"
        >
            <p>
                <span className="font-mono font-semibold">{code}</span>:{" "}
                {message}
                {path ? (
                    <>
                        {" at "}
                        <code className="font-mono">{path}</code>
                    </>
                ) : null}
            </p>
            {issues.length > 1 ? (
                <ul className="mt-1 list-disc ps-4">
                    {issues.map((issue) => (
                        <li key={`${issue.path} ${issue.message}`}>
                            <code className="font-mono">{issue.path}</code>{" "}
                            {issue.message}
                        </li>
                    ))}
                </ul>
            ) : null}
        </div>
    );
}

function CommandList<T extends DockableTypes>({ model }: { model: Model<T> }) {
    return (
        <ul data-testid="command-list" className="flex flex-col">
            {model.commands().map((command) => (
                <li
                    key={command.name}
                    data-command={command.name}
                    className="border-b border-palette-line p-3 text-xs"
                >
                    <p className="font-mono text-sm font-semibold text-palette-contrast">
                        {command.name}
                        {command.transient ? (
                            <span className="ms-2 font-sans text-xs font-normal text-palette-accent">
                                transient-capable
                            </span>
                        ) : null}
                    </p>
                    <p className="mt-1 text-palette-accent">
                        {command.description}
                    </p>
                    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 font-mono">
                        {fieldsOf(command.payloadSchema).map((field) => (
                            <div key={field.name} className="contents">
                                <dt title={field.description}>
                                    {field.name}
                                    {field.required ? "" : "?"}
                                </dt>
                                <dd className="truncate text-palette-accent">
                                    {field.type}
                                </dd>
                            </div>
                        ))}
                    </dl>
                </li>
            ))}
        </ul>
    );
}

function ToolsView<T extends DockableTypes>({ model }: { model: Model<T> }) {
    const commands = model.commands();
    const tools = toTools(commands);
    // what an assistant's call turns into: the command and its payload, for model.dispatch
    const example = fromToolCall(commands, {
        name: toolName("tab.select"),
        input: { tab: "todo" },
    });
    return (
        <div className="flex flex-col gap-3 p-3 text-xs">
            <p className="text-palette-accent">
                Each command is a name, a description and a JSON Schema: any
                assistant that calls tools can drive the layout. Hand it these
                definitions; when it calls one, turn the call back into a
                command and pass it to{" "}
                <code className="font-mono">model.dispatch</code>, which
                validates it like any other untrusted JSON. No network call or
                SDK is involved here.
            </p>
            <pre
                data-testid="tool-call"
                className="rounded-md border border-palette-line bg-palette-soft p-2 font-mono whitespace-pre-wrap"
            >
                {`${toolName("tab.select")}({ "tab": "todo" })\n→ model.dispatch(${JSON.stringify(example)})`}
            </pre>
            <pre
                data-testid="tool-definitions"
                className="overflow-auto rounded-md border border-palette-line bg-palette-soft p-2 font-mono"
            >
                {JSON.stringify(tools, null, 2)}
            </pre>
        </div>
    );
}

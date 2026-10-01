"use client";

import type {
    AnyTypes,
    CommandResult,
    DockableTypes,
    Model,
} from "@fragiola/dockable";
import { useEffect, useId, useState } from "react";
import * as styles from "./styles";
import { fieldsOf, fromToolCall, toolName, toTools } from "./tools";

// The console lives outside the layout and talks to the model only: `commands()` to list what it
// can do, `dispatch` to run a command given as JSON (validated like any untrusted input), and
// `subscribe` to log every change, whoever made it (the console, a drag, a click).

const SAMPLES = [
    {
        label: "Select",
        input: { command: "tab.select", payload: { tabId: "todo" } },
    },
    {
        label: "Move",
        input: { command: "tab.move", payload: { tabId: "ideas", to: "left" } },
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
        input: { command: "tab.move", payload: { tabId: 3 } },
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
        <section aria-label="Command console" className={styles.commandConsole}>
            <div className={styles.viewBar}>
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
                        className={styles.viewButton}
                    >
                        {label}
                    </button>
                ))}
            </div>
            <div className={styles.viewBody}>
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
        <div className={styles.consoleView}>
            <div className={styles.samples}>
                {SAMPLES.map((sample) => (
                    <button
                        key={sample.label}
                        type="button"
                        onClick={() =>
                            setInput(JSON.stringify(sample.input, null, 2))
                        }
                        className={styles.sampleButton}
                    >
                        {sample.label}
                    </button>
                ))}
            </div>
            <label htmlFor={inputId} className={styles.inputLabel}>
                Command (JSON)
            </label>
            <textarea
                id={inputId}
                data-testid="command-input"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                spellCheck={false}
                rows={6}
                className={styles.input}
            />
            <button type="button" onClick={run} className={styles.runButton}>
                Run
            </button>
            <output
                data-testid="result"
                aria-live="polite"
                className={styles.result}
            >
                {parseError ? (
                    <ErrorBox
                        code="parse"
                        message={parseError}
                        path={undefined}
                        issues={[]}
                    />
                ) : result === null ? null : result.ok ? (
                    <div className={styles.success}>
                        <p className={styles.successTitle}>ok</p>
                        <pre className={styles.successValue}>
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
                <h3 className={styles.logTitle}>Log (model.subscribe)</h3>
                <ol data-testid="log" className={styles.log}>
                    {log.map((entry) => (
                        <li key={entry.id} className={styles.logEntry}>
                            <span className={styles.logCommand}>
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
        <div role="alert" className={styles.error}>
            <p>
                <span className={styles.errorCode}>{code}</span>: {message}
                {path ? (
                    <>
                        {" at "}
                        <code className={styles.code}>{path}</code>
                    </>
                ) : null}
            </p>
            {issues.length > 1 ? (
                <ul className={styles.errorIssues}>
                    {issues.map((issue) => (
                        <li key={`${issue.path} ${issue.message}`}>
                            <code className={styles.code}>{issue.path}</code>{" "}
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
        <ul data-testid="command-list" className={styles.commandList}>
            {model.get("commands").map((command) => (
                <li
                    key={command.name}
                    data-command={command.name}
                    className={styles.command}
                >
                    <p className={styles.commandName}>
                        {command.name}
                        {command.transient ? (
                            <span className={styles.commandTransient}>
                                transient-capable
                            </span>
                        ) : null}
                    </p>
                    <p className={styles.commandDescription}>
                        {command.description}
                    </p>
                    <dl className={styles.commandFields}>
                        {fieldsOf(command.payloadSchema).map((field) => (
                            <div
                                key={field.name}
                                className={styles.commandField}
                            >
                                <dt title={field.description}>
                                    {field.name}
                                    {field.required ? "" : "?"}
                                </dt>
                                <dd className={styles.commandFieldType}>
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
    const commands = model.get("commands");
    const tools = toTools(commands);
    // what an assistant's call turns into: the command and its payload, for model.dispatch
    const example = fromToolCall(commands, {
        name: toolName("tab.select"),
        input: { tab: "todo" },
    });
    return (
        <div className={styles.toolsView}>
            <p className={styles.toolsIntro}>
                Each command is a name, a description and a JSON Schema: any
                assistant that calls tools can drive the layout. Hand it these
                definitions; when it calls one, turn the call back into a
                command and pass it to{" "}
                <code className={styles.code}>model.dispatch</code>, which
                validates it like any other untrusted JSON. No network call or
                SDK is involved here.
            </p>
            <pre data-testid="tool-call" className={styles.toolCall}>
                {`${toolName("tab.select")}({ "tab": "todo" })\n→ model.dispatch(${JSON.stringify(example)})`}
            </pre>
            <pre
                data-testid="tool-definitions"
                className={styles.toolDefinitions}
            >
                {JSON.stringify(tools, null, 2)}
            </pre>
        </div>
    );
}

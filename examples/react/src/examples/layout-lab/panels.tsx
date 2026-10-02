"use client";

import type {
    CommandError,
    CommandInfo,
    CommandName,
    CommandResult,
    LayoutJson,
    ValidationIssue,
} from "@fragiola/dockable-react";
import { useId, useState } from "react";
import { Select } from "#/components/ui/select";
import { Switch } from "#/components/ui/switch";
import type { LogEntry, Types } from "./commands";
import * as styles from "./styles";

// The lab's two instruments, both outside the layout: the model's JSON (v1), editable, and the
// log of every command the lab's middleware saw, with a switch that vetoes one command.

interface EditorError {
    message: string;
    /** each problem with its JSON path (RFC 6901) in the document being edited */
    issues: readonly ValidationIssue[];
}

/** `layout.load` reports paths inside its payload (`/layout/...`): the editor shows the layout. */
function documentPath(path: string): string {
    return path.replace(/^\/layout(?=\/|$)/, "") || "/";
}

function editorError(error: CommandError): EditorError {
    return {
        message: error.message,
        issues: (error.issues ?? []).map((issue) => ({
            path: documentPath(issue.path),
            message: issue.message,
        })),
    };
}

/**
 * The current `LayoutJson` (v1). It follows the model until you type; then Apply loads it into the
 * model with `layout.load` (validated first: the problems are listed with their paths and the
 * layout is left alone) and Revert drops the edit.
 */
export function JsonEditor({
    json,
    onApply,
}: {
    json: LayoutJson<Types>;
    /** loads the parsed document (untrusted JSON) into the model */
    onApply: (layout: unknown) => CommandResult<unknown>;
}) {
    const current = JSON.stringify(json, null, 2);
    const [draft, setDraft] = useState<string | null>(null);
    const [error, setError] = useState<EditorError | null>(null);
    const errorId = useId();
    const edited = draft !== null && draft !== current;

    const apply = () => {
        if (draft === null) return;
        let parsed: unknown;
        try {
            parsed = JSON.parse(draft);
        } catch (caught) {
            setError({
                message:
                    caught instanceof Error ? caught.message : String(caught),
                issues: [],
            });
            return;
        }
        const result = onApply(parsed);
        if (result.ok) {
            setDraft(null);
            setError(null);
        } else {
            setError(editorError(result.error));
        }
    };

    return (
        <section aria-label="Model JSON" className={styles.jsonEditor}>
            <div className={styles.jsonHeader}>
                <h2 className={styles.jsonTitle}>LayoutJson</h2>
                <button
                    type="button"
                    disabled={!edited}
                    onClick={() => {
                        setDraft(null);
                        setError(null);
                    }}
                    className={styles.revertButton}
                >
                    Revert
                </button>
                <button
                    type="button"
                    disabled={!edited}
                    onClick={apply}
                    className={styles.applyButton}
                >
                    Apply
                </button>
            </div>
            <textarea
                aria-label="Layout JSON"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                value={draft ?? current}
                onChange={(event) => setDraft(event.target.value)}
                spellCheck={false}
                wrap="off"
                className={styles.jsonText}
            />
            {error ? (
                <div id={errorId} role="alert" className={styles.jsonError}>
                    <p>{error.message}</p>
                    {error.issues.length > 0 ? (
                        <ul className={styles.jsonIssues}>
                            {error.issues.map((issue) => (
                                <li key={`${issue.path} ${issue.message}`}>
                                    <span className={styles.jsonIssuePath}>
                                        {issue.path}
                                    </span>{" "}
                                    {issue.message}
                                </li>
                            ))}
                        </ul>
                    ) : null}
                </div>
            ) : null}
        </section>
    );
}

export interface Veto {
    enabled: boolean;
    command: CommandName;
}

/** The switch and the command it vetoes, chosen from `model.get("commands")`. */
export function VetoControl({
    veto,
    commands,
    onChange,
}: {
    veto: Veto;
    commands: readonly CommandInfo[];
    onChange: (veto: Veto) => void;
}) {
    const items = commands.map((info) => ({
        value: info.name,
        label: info.name,
    }));
    return (
        <div className={styles.veto}>
            <div className={styles.vetoSwitch}>
                <Switch.Root
                    checked={veto.enabled}
                    onCheckedChange={(enabled) =>
                        onChange({ ...veto, enabled })
                    }
                    aria-label="Veto"
                >
                    <Switch.Thumb />
                </Switch.Root>
                <span aria-hidden="true">Veto</span>
            </div>
            <Select.Root
                items={items}
                value={veto.command}
                onValueChange={(value) => {
                    // the chosen item is one of the model's commands
                    const command = commands.find(
                        (info) => info.name === value,
                    )?.name;
                    if (command) onChange({ ...veto, command });
                }}
            >
                <Select.Trigger
                    aria-label="Command to veto"
                    className={styles.vetoTrigger}
                >
                    <Select.Value />
                </Select.Trigger>
                <Select.Content>
                    {items.map((item) => (
                        <Select.Item
                            key={item.value}
                            value={item.value}
                            className={styles.vetoItem}
                        >
                            {item.label}
                        </Select.Item>
                    ))}
                </Select.Content>
            </Select.Root>
        </div>
    );
}

/** Every command, newest first: its name, its payload, and whether it applied (or why not). */
export function CommandLog({
    log,
    onClear,
}: {
    log: LogEntry[];
    onClear: () => void;
}) {
    return (
        <section aria-label="Command log" className={styles.log}>
            <div className={styles.logHeader}>
                <h2 className={styles.logTitle}>
                    model.use
                    <span
                        className={styles.logCount}
                    >{`${log.length} commands`}</span>
                </h2>
                <button
                    type="button"
                    onClick={onClear}
                    disabled={log.length === 0}
                    className={styles.clearButton}
                >
                    Clear
                </button>
            </div>
            <ol data-testid="action-log" className={styles.logList}>
                {log.length === 0 ? (
                    <li className={styles.logEmpty}>
                        Drag, click or resize: every change is a command.
                    </li>
                ) : null}
                {[...log].reverse().map((entry) => (
                    <li
                        key={entry.id}
                        data-vetoed={
                            entry.outcome === "vetoed" ? "" : undefined
                        }
                        className={styles.logEntry}
                    >
                        <span className={styles.logOutcome(entry.outcome)}>
                            {entry.outcome}
                        </span>
                        <span className={styles.logCommand}>
                            {entry.command}
                        </span>
                        <span className={styles.logPayload}>
                            {entry.payload}
                        </span>
                    </li>
                ))}
            </ol>
        </section>
    );
}

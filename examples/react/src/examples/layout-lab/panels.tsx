"use client";

import type {
    CommandError,
    CommandInfo,
    CommandName,
    CommandResult,
    LayoutJson,
    ValidationIssue,
} from "@fragiola/dockable";
import { useId, useState } from "react";
import { Select } from "#/components/ui/select";
import { Switch } from "#/components/ui/switch";
import { cn } from "#/lib/cn";
import * as styles from "../_kit/styles";
import type { LogEntry, Types } from "./commands";

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
        <section
            aria-label="Model JSON"
            className="palette-surface flex w-72 shrink-0 flex-col border-e border-palette-line bg-palette-base max-md:hidden"
        >
            <div className="flex h-11 shrink-0 items-center gap-2 border-b border-palette-line px-3">
                <h2 className="me-auto text-sm font-semibold">LayoutJson</h2>
                <button
                    type="button"
                    disabled={!edited}
                    onClick={() => {
                        setDraft(null);
                        setError(null);
                    }}
                    className={cn(styles.button, "h-7 px-2 text-xs")}
                >
                    Revert
                </button>
                <button
                    type="button"
                    disabled={!edited}
                    onClick={apply}
                    className={cn(
                        "palette-blue",
                        styles.solidButton,
                        "h-7 px-2 text-xs",
                    )}
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
                className="min-h-0 flex-1 resize-none bg-transparent p-3 font-mono text-xs leading-5 text-palette-contrast outline-none focus-visible:ring-2 focus-visible:ring-palette-ring focus-visible:ring-inset"
            />
            {error ? (
                <div
                    id={errorId}
                    role="alert"
                    className="palette-danger max-h-40 overflow-auto border-t border-palette-line bg-palette-soft px-3 py-2 text-xs text-palette-accent"
                >
                    <p>{error.message}</p>
                    {error.issues.length > 0 ? (
                        <ul className="mt-1 flex flex-col gap-0.5 font-mono">
                            {error.issues.map((issue) => (
                                <li key={`${issue.path} ${issue.message}`}>
                                    <span className="font-semibold">
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

/** The switch and the command it vetoes, chosen from `model.commands()`. */
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
        <div className="flex items-center gap-2 text-sm">
            <div className="flex items-center gap-2">
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
                    className="h-8 w-40 py-0 font-mono text-xs"
                >
                    <Select.Value />
                </Select.Trigger>
                <Select.Content>
                    {items.map((item) => (
                        <Select.Item
                            key={item.value}
                            value={item.value}
                            className="font-mono text-xs"
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
        <section
            aria-label="Command log"
            className="palette-surface flex h-36 shrink-0 flex-col border-t border-palette-line bg-palette-base"
        >
            <div className="flex h-8 shrink-0 items-center gap-2 px-3">
                <h2 className="me-auto text-xs font-semibold">
                    model.use
                    <span className="ms-2 font-normal text-palette-accent/85">{`${log.length} commands`}</span>
                </h2>
                <button
                    type="button"
                    onClick={onClear}
                    disabled={log.length === 0}
                    className={cn(styles.button, "h-6 px-2 text-xs")}
                >
                    Clear
                </button>
            </div>
            <ol
                data-testid="action-log"
                className="min-h-0 flex-1 overflow-auto px-3 pb-2 font-mono text-xs leading-5"
            >
                {log.length === 0 ? (
                    <li className="text-palette-accent/85">
                        Drag, click or resize: every change is a command.
                    </li>
                ) : null}
                {[...log].reverse().map((entry) => (
                    <li
                        key={entry.id}
                        data-vetoed={
                            entry.outcome === "vetoed" ? "" : undefined
                        }
                        className="flex gap-2 whitespace-nowrap"
                    >
                        <span
                            className={cn(
                                "min-w-14 shrink-0",
                                entry.outcome === "applied"
                                    ? "palette-green text-palette-accent"
                                    : "palette-danger text-palette-accent",
                            )}
                        >
                            {entry.outcome}
                        </span>
                        <span className="shrink-0 font-semibold">
                            {entry.command}
                        </span>
                        <span className="truncate text-palette-accent/85">
                            {entry.payload}
                        </span>
                    </li>
                ))}
            </ol>
        </section>
    );
}

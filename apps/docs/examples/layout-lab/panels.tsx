"use client";

import { type IJsonModel, Model } from "@fragiola/dockable";
import { useId, useState } from "react";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/cn";
import * as styles from "../_kit/styles";
import { ACTION_TYPES, actionName, type LogEntry } from "./actions";

// The lab's two instruments, both outside the layout: the JSON of the model, editable, and the
// log of every action `onAction` saw, with a switch that vetoes one action type.

/**
 * The current `IJsonModel`. It follows the model until you type; then Apply builds a new model
 * with `Model.fromJson` (errors are shown, the layout is left alone) and Revert drops the edit.
 */
export function JsonEditor({
    json,
    onApply,
}: {
    json: IJsonModel;
    onApply: (model: Model) => void;
}) {
    const current = JSON.stringify(json, null, 2);
    const [draft, setDraft] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const errorId = useId();
    const edited = draft !== null && draft !== current;

    const apply = () => {
        if (draft === null) return;
        try {
            const parsed = JSON.parse(draft) as IJsonModel;
            if (typeof parsed?.layout !== "object" || parsed.layout === null) {
                throw new Error('The model needs a "layout" row.');
            }
            onApply(Model.fromJson(parsed));
            setDraft(null);
            setError(null);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : String(caught));
        }
    };

    return (
        <section
            aria-label="Model JSON"
            className="palette-surface flex w-72 shrink-0 flex-col border-e border-palette-line bg-palette-base max-md:hidden"
        >
            <div className="flex h-11 shrink-0 items-center gap-2 border-b border-palette-line px-3">
                <h2 className="me-auto text-sm font-semibold">IJsonModel</h2>
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
                <p
                    id={errorId}
                    role="alert"
                    className="palette-danger border-t border-palette-line bg-palette-soft px-3 py-2 text-xs text-palette-accent"
                >
                    {error}
                </p>
            ) : null}
        </section>
    );
}

export interface Veto {
    enabled: boolean;
    type: string;
}

/** The switch and the action type it vetoes. */
export function VetoControl({
    veto,
    onChange,
    popupTheme,
}: {
    veto: Veto;
    onChange: (veto: Veto) => void;
    popupTheme: { "data-example-theme": string | undefined };
}) {
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
                items={ACTION_TYPES}
                value={veto.type}
                onValueChange={(type) =>
                    onChange({ ...veto, type: String(type) })
                }
            >
                <Select.Trigger
                    aria-label="Action type to veto"
                    className="h-8 w-40 py-0 font-mono text-xs"
                >
                    <Select.Value />
                </Select.Trigger>
                <Select.Content {...popupTheme}>
                    {ACTION_TYPES.map((item) => (
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

/** Every action, newest first: its `Actions.x` name, its payload, and whether it was vetoed. */
export function ActionLog({
    log,
    onClear,
}: {
    log: LogEntry[];
    onClear: () => void;
}) {
    return (
        <section
            aria-label="Action log"
            className="palette-surface flex h-36 shrink-0 flex-col border-t border-palette-line bg-palette-base"
        >
            <div className="flex h-8 shrink-0 items-center gap-2 px-3">
                <h2 className="me-auto text-xs font-semibold">
                    onAction
                    <span className="ms-2 font-normal text-palette-accent/85">{`${log.length} actions`}</span>
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
                        Drag, click or resize: every change is an action.
                    </li>
                ) : null}
                {[...log].reverse().map((entry) => (
                    <li
                        key={entry.id}
                        data-vetoed={entry.vetoed ? "" : undefined}
                        className="flex gap-2 whitespace-nowrap"
                    >
                        <span
                            className={cn(
                                "w-14 shrink-0",
                                entry.vetoed
                                    ? "palette-danger text-palette-accent"
                                    : "palette-green text-palette-accent",
                            )}
                        >
                            {entry.vetoed ? "vetoed" : "applied"}
                        </span>
                        <span className="shrink-0 font-semibold">{`Actions.${actionName(entry.type)}`}</span>
                        <span className="truncate text-palette-accent/85">
                            {entry.payload}
                        </span>
                    </li>
                ))}
            </ol>
        </section>
    );
}

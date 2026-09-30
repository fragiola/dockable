import {
    booleanSchema,
    borderModeSchema,
    idSchema,
    nullable,
    object,
    orientationSchema,
    sizeSchema,
} from "../schema/fragments";
import { layoutDefs, layoutDocumentSchema } from "../schema/layout";
import type { JsonSchema } from "../schema/types";
import { validate } from "../schema/validator";
import type { Draft } from "../state/draft";
import { type AnyNode, childrenOf, walkState } from "../state/tree";
import type { LayoutDefaults } from "../state/types";
import { defineCommand, ok } from "./define";
import type { CommandError } from "./types";

const nullableBoolean = nullable(booleanSchema);
const nullableSize = nullable(sizeSchema);

const defaultsPatchSchema = object({
    tab: nullable(
        object({
            enableClose: nullableBoolean,
            enableDrag: nullableBoolean,
            enablePopout: nullableBoolean,
            minWidth: nullableSize,
            minHeight: nullableSize,
            maxWidth: nullableSize,
            maxHeight: nullableSize,
        }),
    ),
    tabset: nullable(
        object({
            enableDrop: nullableBoolean,
            enableDrag: nullableBoolean,
            enableDivide: nullableBoolean,
            enableMaximize: nullableBoolean,
            enableClose: nullableBoolean,
            deleteWhenEmpty: nullableBoolean,
            autoSelectTab: nullableBoolean,
            minWidth: nullableSize,
            minHeight: nullableSize,
            maxWidth: nullableSize,
            maxHeight: nullableSize,
        }),
    ),
    border: nullable(
        object({
            size: nullableSize,
            minSize: nullableSize,
            maxSize: nullableSize,
            mode: nullable(borderModeSchema),
            autoHide: nullableBoolean,
            enableDrop: nullableBoolean,
            autoSelectTabWhenOpen: nullableBoolean,
            autoSelectTabWhenClosed: nullableBoolean,
        }),
    ),
    layout: nullable(
        object({
            rootOrientation: nullable(orientationSchema),
            edgeDock: nullableBoolean,
            edgeDockMargin: nullableSize,
            edgeDockLength: nullableSize,
        }),
    ),
});

const KINDS = ["tab", "tabset", "border", "layout"] as const;

export const layoutConfigure = defineCommand({
    name: "layout.configure",
    description:
        "Change the layout defaults: the default behaviour of tabs, tabsets and borders, and layout settings (root orientation, edge docking). Fields are merged; a null value removes one.",
    payloadSchema: object(
        {
            defaults: {
                ...defaultsPatchSchema,
                description:
                    "the defaults to change, by kind (tab, tabset, border, layout)",
            },
        },
        ["defaults"],
    ),
    resultSchema: object({}),
    transient: false,
    reduce(payload, { draft }) {
        const next: Record<string, Record<string, unknown>> = {};
        const current = draft.getDefaults() as Record<
            string,
            Record<string, unknown> | undefined
        >;
        for (const kind of KINDS) {
            const existing = current[kind];
            if (existing) {
                next[kind] = { ...existing };
            }
        }
        for (const kind of KINDS) {
            const patch = payload.defaults[kind];
            if (patch === undefined) {
                continue;
            }
            if (patch === null) {
                delete next[kind];
                continue;
            }
            const merged: Record<string, unknown> = { ...next[kind] };
            for (const [key, value] of Object.entries(patch)) {
                if (value === null) {
                    delete merged[key];
                } else if (value !== undefined) {
                    merged[key] = value;
                }
            }
            if (Object.keys(merged).length > 0) {
                next[kind] = merged;
            } else {
                delete next[kind];
            }
        }
        draft.setDefaults(next as LayoutDefaults);
        return ok({});
    },
});

/** Every node and window id of the draft's current tree. */
function currentIds(draft: Draft): Set<string> {
    const ids = new Set<string>();
    const visit = (id: string | undefined) => {
        const node: AnyNode | undefined =
            id === undefined ? undefined : draft.get(id);
        if (!node) {
            return;
        }
        ids.add(node.id);
        for (const child of childrenOf(node)) {
            visit(child.id);
        }
    };
    for (const layout of draft.layoutIds()) {
        if (layout !== "main") {
            ids.add(layout);
        }
        visit(draft.rootOf(layout));
    }
    for (const border of draft.borders()) {
        visit(border);
    }
    return ids;
}

/** `layout.load`'s payload schema: the layout document, with its `$defs` hoisted to the root. */
const layoutLoadSchema: JsonSchema = {
    ...object(
        {
            layout: {
                $ref: "#/$defs/layout",
                description: "a layout document (JSON v1)",
            },
        },
        ["layout"],
    ),
    $defs: { ...layoutDefs, layout: layoutDocumentSchema },
};

export const layoutLoad = defineCommand({
    name: "layout.load",
    description:
        "Replace the whole layout with a JSON v1 document (a saved layout, an undo step, a remote sync). Nodes keep their identity by id, so tabs whose ids survive keep their mounted content.",
    payloadSchema: layoutLoadSchema,
    resultSchema: object(
        {
            added: {
                type: "array",
                items: idSchema,
                description: "ids only in the new layout",
            },
            removed: {
                type: "array",
                items: idSchema,
                description: "ids only in the old layout",
            },
        },
        ["added", "removed"],
    ),
    transient: false,
    reduce(payload, { draft, loadLayout }) {
        const before = currentIds(draft);
        const built = loadLayout(payload.layout, "/layout");
        if (!built.ok) {
            return { ok: false, error: built.error };
        }
        const after = new Set<string>();
        walkState(built.state, (node) => after.add(node.id));
        for (const windowLayout of built.state.windows) {
            after.add(windowLayout.id);
        }
        draft.reset(built.state, built.index);
        return ok({
            added: [...after].filter((id) => !before.has(id)),
            removed: [...before].filter((id) => !after.has(id)),
        });
    },
});

const batchEntrySchema = object(
    {
        command: {
            type: "string",
            minLength: 1,
            description: "the command's name",
        },
        payload: { type: "object", description: "the command's payload" },
    },
    ["command", "payload"],
);

export const batchPayloadSchema = object(
    {
        commands: {
            type: "array",
            items: batchEntrySchema,
            description: "the commands to run, in order",
        },
    },
    ["commands"],
);

export const batch = defineCommand({
    name: "batch",
    description:
        "Run several commands in order as one atomic step: if any fails, none applies. Emits one change event. Nested batches are flattened.",
    payloadSchema: batchPayloadSchema,
    resultSchema: object(
        {
            results: {
                type: "array",
                items: {},
                description: "each command's value, in order",
            },
        },
        ["results"],
    ),
    transient: true,
    reduce(payload, { runInBatch }) {
        const results: unknown[] = [];
        const runAll = (
            commands: readonly { command: string; payload: unknown }[],
            path: string,
        ): { readonly ok: false; readonly error: CommandError } | undefined => {
            for (const [i, entry] of commands.entries()) {
                const at = `${path}/${i}`;
                if (entry.command === "batch") {
                    const issues = validate(
                        batchPayloadSchema,
                        entry.payload,
                        `${at}/payload`,
                    );
                    const first = issues[0];
                    if (first) {
                        return {
                            ok: false as const,
                            error: {
                                code: "invalid_payload" as const,
                                message: first.message,
                                path: first.path,
                                issues,
                            },
                        };
                    }
                    const nested = entry.payload as {
                        commands: { command: string; payload: unknown }[];
                    };
                    const failed = runAll(
                        nested.commands,
                        `${at}/payload/commands`,
                    );
                    if (failed) {
                        return failed;
                    }
                    continue;
                }
                const result = runInBatch(entry.command, entry.payload, at);
                if (!result.ok) {
                    return result;
                }
                results.push(result.value);
            }
            return undefined;
        };
        const failed = runAll(payload.commands, "/commands");
        return failed ?? ok({ results });
    },
});

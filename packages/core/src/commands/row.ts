import { dataSchema, describedId, idSchema, object } from "../schema/fragments";
import { cloneJson } from "../state/clone";
import { defineCommand, fail, ok } from "./define";

const rowId = { ...idSchema, description: "the row's id" } as const;

const rowIdResult = object({ row: describedId("row") }, ["row"]);

export const rowResize = defineCommand({
    name: "row.resize",
    description:
        "Set the relative weights of a row's children, one positive number per child in order (the splitters issue this while dragged).",
    payloadSchema: object(
        {
            row: rowId,
            weights: {
                type: "array",
                items: { type: "number", exclusiveMinimum: 0 },
                description: "one positive weight per child, in order",
            },
        },
        ["row", "weights"],
    ),
    resultSchema: rowIdResult,
    transient: true,
    reduce(payload, { draft }) {
        const row = draft.row(payload.row);
        if (!row || !draft.isAttached(row.id)) {
            return fail("not_found", `no row "${payload.row}"`, "/row");
        }
        if (payload.weights.length !== row.children.length) {
            return fail(
                "invalid_payload",
                `row "${row.id}" has ${row.children.length} children, not ${payload.weights.length}`,
                "/weights",
            );
        }
        for (const [i, child] of row.children.entries()) {
            const weight = payload.weights[i];
            if (weight !== undefined) {
                draft.set(child.id, "weight", weight);
            }
        }
        return ok({ row: row.id });
    },
});

export const rowConfigure = defineCommand({
    name: "row.configure",
    description: "Set (or, with null, remove) a row's data.",
    payloadSchema: object({ row: rowId, data: dataSchema }, ["row"]),
    resultSchema: rowIdResult,
    transient: false,
    reduce(payload, { draft }) {
        const row = draft.row(payload.row);
        if (!row || !draft.isAttached(row.id)) {
            return fail("not_found", `no row "${payload.row}"`, "/row");
        }
        if (payload.data !== undefined) {
            draft.set(
                row.id,
                "data",
                payload.data === null ? undefined : cloneJson(payload.data),
            );
        }
        return ok({ row: row.id });
    },
});

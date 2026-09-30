import {
    booleanSchema,
    borderModeSchema,
    dataSchema,
    idSchema,
    nullable,
    object,
    sizeSchema,
} from "../schema/fragments";
import { cloneJson } from "../state/clone";
import { isVerticalBorder, resolveBorder } from "../state/defaults";
import { defineCommand, fail, ok } from "./define";

const borderId = {
    ...idSchema,
    description:
        "the border's id (border_<location> unless the layout names it)",
} as const;

const borderIdResult = object({ border: idSchema }, ["border"]);

export const borderResize = defineCommand({
    name: "border.resize",
    description:
        "Set the size in px of a border's panel (of its selected tab when that tab has its own border size). The size is clamped to the border's min and max.",
    payloadSchema: object({ border: borderId, size: sizeSchema }, [
        "border",
        "size",
    ]),
    resultSchema: object({ border: idSchema, size: sizeSchema }, [
        "border",
        "size",
    ]),
    transient: true,
    reduce(payload, { draft }) {
        const border = draft.border(payload.border);
        if (!border) {
            return fail(
                "not_found",
                `no border "${payload.border}"`,
                "/border",
            );
        }
        const resolved = resolveBorder(draft.getDefaults(), border);
        const size = Math.max(
            resolved.minSize,
            Math.min(resolved.maxSize, payload.size),
        );
        const tab =
            border.selected >= 0 ? border.children[border.selected] : undefined;
        const key = isVerticalBorder(border.location)
            ? "borderWidth"
            : "borderHeight";
        if (tab && tab[key] !== undefined) {
            draft.set(tab.id, key, size);
        } else {
            draft.set(border.id, "size", size);
        }
        return ok({ border: border.id, size });
    },
});

export const borderConfigure = defineCommand({
    name: "border.configure",
    description:
        "Open or close a border's panel (open), switch it between docked and overlay (mode), show or hide it, or change its sizes, flags or data. Opening selects its first tab when none is selected. A null value removes the border's own value so the layout default applies.",
    payloadSchema: object(
        {
            border: borderId,
            open: {
                ...booleanSchema,
                description: "open (true) or close (false) the border's panel",
            },
            mode: nullable(borderModeSchema),
            show: nullable(booleanSchema),
            autoHide: nullable(booleanSchema),
            enableDrop: nullable(booleanSchema),
            autoSelectTabWhenOpen: nullable(booleanSchema),
            autoSelectTabWhenClosed: nullable(booleanSchema),
            size: nullable(sizeSchema),
            minSize: nullable(sizeSchema),
            maxSize: nullable(sizeSchema),
            data: dataSchema,
        },
        ["border"],
    ),
    resultSchema: borderIdResult,
    transient: false,
    reduce(payload, { draft }) {
        const border = draft.border(payload.border);
        if (!border) {
            return fail(
                "not_found",
                `no border "${payload.border}"`,
                "/border",
            );
        }
        if (payload.open === true && border.selected === -1) {
            if (border.children.length === 0) {
                return fail(
                    "refused",
                    `border "${border.id}" has no tabs to open`,
                    "/open",
                );
            }
            draft.set(border.id, "selected", 0);
        } else if (payload.open === false) {
            draft.set(border.id, "selected", -1);
        }
        for (const [key, value] of Object.entries(payload)) {
            if (key !== "border" && key !== "open" && value !== undefined) {
                draft.set(
                    border.id,
                    key,
                    value === null ? undefined : cloneJson(value),
                );
            }
        }
        return ok({ border: border.id });
    },
});

// The text render of a layout, after FlexLayout's tests/Model.test.ts harness: every tab as its
// path, its label and a `*` when it is its container's selected tab, e.g. `/ts0/t1[Two]*`.
import type { LayoutJson } from "../../src/state/json";
import { createModel, type Model } from "../../src/state/model";
import type {
    AnyTypes,
    BorderNode,
    RowNode,
    TabsetNode,
} from "../../src/state/types";

type Json = LayoutJson<AnyTypes>;

function label(tab: { label: string }): string {
    return tab.label;
}

function renderTabs(
    container: TabsetNode | BorderNode,
    path: string,
    out: string[],
) {
    for (const [i, tab] of container.children.entries()) {
        const selected = container.selected === i ? "*" : "";
        out.push(`${path}/t${i}[${label(tab)}]${selected}`);
    }
}

function renderRow(row: RowNode, path: string, out: string[]) {
    for (const [i, child] of row.children.entries()) {
        if (child.type === "row") {
            renderRow(child, `${path}/r${i}`, out);
        } else {
            renderTabs(child, `${path}/ts${i}`, out);
        }
    }
}

/** The tabs of every layout as `path[label]` (`*` when selected), comma separated. */
export function render(model: Model): string {
    const out: string[] = [];
    for (const border of model.state.borders) {
        renderTabs(border, `/b/${border.location}`, out);
    }
    renderRow(model.state.root, "", out);
    for (const [i, window] of model.state.windows.entries()) {
        renderRow(window.root, `/w${i}`, out);
    }
    return out.join(",");
}

/** The node at a render path (`/ts0`, `/r1/ts0`, `/ts0/t1`, `/b/left/t0`). */
export function at(model: Model, path: string): string {
    const parts = path.split("/").filter(Boolean);
    let node:
        | RowNode
        | TabsetNode
        | BorderNode
        | { id: string; type: "tab" }
        | undefined = model.state.root;
    if (parts[0] === "b") {
        node = model.state.borders.find(
            (border) => border.location === parts[1],
        );
        parts.splice(0, 2);
    } else if (parts[0]?.startsWith("w")) {
        node = model.state.windows[Number(parts[0].slice(1))]?.root;
        parts.shift();
    }
    for (const part of parts) {
        const index = Number(part.replace(/^[a-z]+/, ""));
        if (!node || node.type === "tab") {
            throw new Error(`no node at ${path}`);
        }
        node = node.children[index];
    }
    if (!node) {
        throw new Error(`no node at ${path}`);
    }
    return node.id;
}

/** A tab of the test registry, its id and label both `name`. */
export function tab(name: string, extra: Record<string, unknown> = {}) {
    return { id: name, component: "test", label: name, ...extra };
}

/** A layout of tabsets side by side, each a list of tab names. */
export function tabsets(...sets: string[][]): Json {
    return {
        version: 1,
        root: {
            type: "row",
            id: "root",
            children: sets.map((names, i) => ({
                type: "tabset" as const,
                id: `ts${i}`,
                children: names.map((name) => tab(name)),
            })),
        },
    };
}

/** A model of `json`, and its render. */
export function setup(json: Json): { model: Model; text: () => string } {
    const model = createModel(json);
    return { model, text: () => render(model) };
}

/** Runs a command and fails the test when it did not apply. */
export function must<V>(
    result:
        | { ok: true; value: V }
        | { ok: false; error: { code: string; message: string } },
): V {
    if (!result.ok) {
        throw new Error(`${result.error.code}: ${result.error.message}`);
    }
    return result.value;
}

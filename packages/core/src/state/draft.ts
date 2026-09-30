import type { Rect } from "../geometry/rect";
import type { IdKind, IdSource } from "./ids";
import {
    type AnyBorder,
    type AnyNode,
    type AnyRow,
    type AnyState,
    type AnyTab,
    type AnyTabset,
    type AnyWindow,
    childrenOf,
    type NodeIndex,
} from "./tree";
import { type LayoutDefaults, MAIN_LAYOUT } from "./types";

/** A node's writable form inside a draft: its fields writable, its children a plain array. */
export type Mutable<N> = {
    -readonly [K in keyof N]: N[K] extends readonly (infer E)[] ? E[] : N[K];
};
export type MutableRow = Mutable<AnyRow>;
export type MutableTabset = Mutable<AnyTabset>;
export type MutableTab = Mutable<AnyTab>;
export type MutableBorder = Mutable<AnyBorder>;
type MutableNode = MutableRow | MutableTabset | MutableTab | MutableBorder;
type MutableParent = MutableRow | MutableTabset | MutableBorder;

interface LayoutRecord {
    root: string;
    active: string | undefined;
    maximized: string | undefined;
    /** a window's rect (undefined for the main layout) */
    rect: Rect | undefined;
}

function cloneNode(node: AnyNode): MutableNode {
    if (node.type === "tab") {
        return { ...node };
    }
    return { ...node, children: [...node.children] } as MutableNode;
}

/** Freezes a value and everything below it that is not frozen yet. */
export function deepFreeze<V>(value: V): V {
    if (
        typeof value === "object" &&
        value !== null &&
        !Object.isFrozen(value)
    ) {
        Object.freeze(value);
        for (const child of Object.values(value)) {
            deepFreeze(child);
        }
    }
    return value;
}

/** What a commit produced. */
export interface CommitResult {
    state: AnyState;
    index: NodeIndex;
    /** false when the draft changed nothing: `state` is then the base state itself */
    changed: boolean;
    /** the ids (nodes and windows) no longer in the state */
    removed: string[];
}

/**
 * A copy-on-write transaction over a state. Commands read and write the tree through it; nothing
 * is visible outside until {@link commit}. Editing a node clones it and its ancestors once, so the
 * committed state shares every untouched subtree with the previous one (structural sharing), and the
 * id index is updated for the touched nodes only.
 */
export class Draft {
    private base: AnyState;
    private index: NodeIndex;
    private readonly ids: IdSource;
    /** the mutable versions of the nodes edited or created in this draft */
    private readonly nodes = new Map<string, MutableNode>();
    /** parent overrides: nodes moved, attached or detached in this draft (undefined: detached) */
    private readonly parents = new Map<string, string | undefined>();
    /** ids detached at some point: removed at commit unless attached again */
    private readonly detached = new Set<string>();
    private readonly layouts = new Map<string, LayoutRecord>();
    private readonly baseWindows = new Map<string, AnyWindow>();
    private readonly removedWindows = new Map<string, string>();
    private borderIds: string[];
    private defaults: LayoutDefaults;
    private structureChanged = false;
    private replaced = false;
    /** ids handed out in this draft (not in the index yet) */
    private readonly issued = new Set<string>();

    /** ids a generated id must not take (the ids of a state being replaced) */
    private readonly reserved: ((id: string) => boolean) | undefined;

    constructor(
        base: AnyState,
        index: NodeIndex,
        ids: IdSource,
        reserved?: (id: string) => boolean,
    ) {
        this.base = base;
        this.index = index;
        this.ids = ids;
        this.reserved = reserved;
        this.borderIds = [];
        this.defaults = base.defaults;
        this.load(base);
    }

    private load(base: AnyState) {
        this.layouts.clear();
        this.baseWindows.clear();
        this.layouts.set(MAIN_LAYOUT, {
            root: base.root.id,
            active: base.active,
            maximized: base.maximized,
            rect: undefined,
        });
        for (const windowLayout of base.windows) {
            this.baseWindows.set(windowLayout.id, windowLayout);
            this.layouts.set(windowLayout.id, {
                root: windowLayout.root.id,
                active: windowLayout.active,
                maximized: windowLayout.maximized,
                rect: windowLayout.rect,
            });
        }
        this.borderIds = base.borders.map((border) => border.id);
        this.defaults = base.defaults;
    }

    /**
     * Replaces the whole state (`layout.load`): what follows in the same draft (a batch) applies to
     * `state`, and the commit hands over `index` instead of updating the current one.
     */
    reset(state: AnyState, index: NodeIndex): void {
        this.base = state;
        this.index = index;
        this.nodes.clear();
        this.parents.clear();
        this.detached.clear();
        this.removedWindows.clear();
        this.load(state);
        this.structureChanged = false;
        this.replaced = true;
    }

    /** the state this draft started from (or was reset to) */
    get baseState(): AnyState {
        return this.base;
    }

    // ---------------------------------------------------------------------------------------------
    // reading
    // ---------------------------------------------------------------------------------------------

    get(id: string): AnyNode | undefined {
        return (
            (this.nodes.get(id) as AnyNode | undefined) ?? this.index.get(id)
        );
    }

    tab(id: string): AnyTab | undefined {
        const node = this.get(id);
        return node?.type === "tab" ? node : undefined;
    }

    tabset(id: string): AnyTabset | undefined {
        const node = this.get(id);
        return node?.type === "tabset" ? node : undefined;
    }

    row(id: string): AnyRow | undefined {
        const node = this.get(id);
        return node?.type === "row" ? node : undefined;
    }

    border(id: string): AnyBorder | undefined {
        const node = this.get(id);
        return node?.type === "border" ? node : undefined;
    }

    parentOf(id: string): string | undefined {
        return this.parents.has(id)
            ? this.parents.get(id)
            : this.index.parent(id);
    }

    /** the topmost ancestor of `id` (itself for a root row or a border) */
    private topOf(id: string): string {
        let current = id;
        for (let parent = this.parentOf(current); parent !== undefined; ) {
            current = parent;
            parent = this.parentOf(current);
        }
        return current;
    }

    /** the layout a node belongs to, or undefined when it is not in the tree */
    layoutOf(id: string): string | undefined {
        if (!this.get(id)) {
            return undefined;
        }
        const top = this.topOf(id);
        if (this.borderIds.includes(top)) {
            return MAIN_LAYOUT;
        }
        for (const [layout, record] of this.layouts) {
            if (record.root === top) {
                return layout;
            }
        }
        return undefined;
    }

    /** whether a node is in the tree (reachable from a layout's root or a border) */
    isAttached(id: string): boolean {
        return this.layoutOf(id) !== undefined;
    }

    /** the root row id of a layout */
    rootOf(layout: string): string | undefined {
        return this.layouts.get(layout)?.root;
    }

    /** the ids of the layouts: main first, then the windows in order */
    layoutIds(): string[] {
        return [...this.layouts.keys()];
    }

    /** the ids of the borders, in order */
    borders(): readonly string[] {
        return this.borderIds;
    }

    getDefaults(): LayoutDefaults {
        return this.defaults;
    }

    getActive(layout: string): string | undefined {
        return this.layouts.get(layout)?.active;
    }

    getMaximized(layout: string): string | undefined {
        return this.layouts.get(layout)?.maximized;
    }

    windowRect(layout: string): Rect | undefined {
        return this.layouts.get(layout)?.rect;
    }

    /** whether an id is used by a node or a layout (or was handed out in this draft) */
    isUsed(id: string): boolean {
        return (
            id === MAIN_LAYOUT ||
            this.index.has(id) ||
            this.nodes.has(id) ||
            this.layouts.has(id) ||
            this.issued.has(id) ||
            (this.reserved?.(id) ?? false)
        );
    }

    /** a fresh id */
    newId(kind: IdKind): string {
        const id = this.ids.next(kind, (candidate) => this.isUsed(candidate));
        this.issued.add(id);
        return id;
    }

    // ---------------------------------------------------------------------------------------------
    // writing
    // ---------------------------------------------------------------------------------------------

    /** the writable version of a node: cloned once, with its ancestors, on first write */
    edit(id: string): MutableNode {
        const existing = this.nodes.get(id);
        if (existing) {
            return existing;
        }
        const original = this.index.get(id);
        if (!original) {
            throw new Error(`Draft.edit: unknown node "${id}"`);
        }
        const clone = cloneNode(original);
        this.nodes.set(id, clone);
        const parent = this.parentOf(id);
        if (parent !== undefined) {
            const writable = this.editParent(parent);
            const at = writable.children.findIndex((child) => child.id === id);
            if (at >= 0) {
                (writable.children as AnyNode[])[at] = clone as AnyNode;
            }
        }
        return clone;
    }

    editTab(id: string): MutableTab {
        const node = this.edit(id);
        if (node.type !== "tab") {
            throw new Error(`Draft.editTab: "${id}" is a ${node.type}`);
        }
        return node;
    }

    editTabset(id: string): MutableTabset {
        const node = this.edit(id);
        if (node.type !== "tabset") {
            throw new Error(`Draft.editTabset: "${id}" is a ${node.type}`);
        }
        return node;
    }

    editRow(id: string): MutableRow {
        const node = this.edit(id);
        if (node.type !== "row") {
            throw new Error(`Draft.editRow: "${id}" is a ${node.type}`);
        }
        return node;
    }

    editBorder(id: string): MutableBorder {
        const node = this.edit(id);
        if (node.type !== "border") {
            throw new Error(`Draft.editBorder: "${id}" is a ${node.type}`);
        }
        return node;
    }

    private editParent(id: string): MutableParent {
        const node = this.edit(id);
        if (node.type === "tab") {
            throw new Error(`Draft: a tab ("${id}") has no children`);
        }
        return node;
    }

    /**
     * Sets a field of a node, or removes it with `undefined`. A value equal to the current one
     * changes nothing (the node is not cloned).
     */
    set(id: string, key: string, value: unknown): void {
        const current = this.get(id) as unknown as
            | Record<string, unknown>
            | undefined;
        if (!current) {
            throw new Error(`Draft.set: unknown node "${id}"`);
        }
        if (value === undefined ? !(key in current) : current[key] === value) {
            return;
        }
        const node = this.edit(id) as unknown as Record<string, unknown>;
        if (value === undefined) {
            delete node[key];
        } else {
            node[key] = value;
        }
    }

    /** Adds a node created in this draft (detached until {@link attach}ed). */
    create<N extends MutableNode>(node: N): N {
        this.nodes.set(node.id, node);
        this.parents.set(node.id, undefined);
        this.detached.add(node.id);
        this.issued.delete(node.id);
        return node;
    }

    /** Removes a node from its parent; returns where it was. */
    detach(id: string): { parent: string; index: number } | undefined {
        const parent = this.parentOf(id);
        if (parent === undefined) {
            return undefined;
        }
        const writable = this.editParent(parent);
        const index = writable.children.findIndex((child) => child.id === id);
        if (index >= 0) {
            writable.children.splice(index, 1);
        }
        this.parents.set(id, undefined);
        this.detached.add(id);
        this.structureChanged = true;
        return { parent, index };
    }

    /**
     * Inserts a node into a parent's children at `index` (appended when omitted or out of range),
     * detaching it from its current parent first.
     */
    attach(parent: string, id: string, index?: number): void {
        if (this.parentOf(id) !== undefined) {
            this.detach(id);
        }
        const node = this.get(id);
        if (!node) {
            throw new Error(`Draft.attach: unknown node "${id}"`);
        }
        const writable = this.editParent(parent);
        const at =
            index === undefined || index < 0 || index > writable.children.length
                ? writable.children.length
                : index;
        (writable.children as AnyNode[]).splice(at, 0, node);
        this.parents.set(id, parent);
        this.structureChanged = true;
    }

    setActive(layout: string, tabset: string | undefined): void {
        const record = this.layouts.get(layout);
        if (record && record.active !== tabset) {
            record.active = tabset;
            this.structureChanged = true;
        }
    }

    setMaximized(layout: string, tabset: string | undefined): void {
        const record = this.layouts.get(layout);
        if (record && record.maximized !== tabset) {
            record.maximized = tabset;
            this.structureChanged = true;
        }
    }

    setWindowRect(layout: string, rect: Rect): void {
        const record = this.layouts.get(layout);
        if (record && layout !== MAIN_LAYOUT) {
            record.rect = rect;
            this.structureChanged = true;
        }
    }

    /** Adds a window layout whose root row (created in this draft) is `root`. */
    addWindow(id: string, root: string, rect: Rect): void {
        this.parents.set(root, undefined);
        this.detached.delete(root);
        this.layouts.set(id, {
            root,
            active: undefined,
            maximized: undefined,
            rect,
        });
        this.issued.delete(id);
        this.structureChanged = true;
    }

    /** Removes a window layout and everything in it. */
    removeWindow(id: string): void {
        const record = this.layouts.get(id);
        if (!record || id === MAIN_LAYOUT) {
            return;
        }
        this.layouts.delete(id);
        this.removedWindows.set(id, record.root);
        this.structureChanged = true;
    }

    setDefaults(defaults: LayoutDefaults): void {
        this.defaults = defaults;
        this.structureChanged = true;
    }

    // ---------------------------------------------------------------------------------------------
    // committing
    // ---------------------------------------------------------------------------------------------

    /** whether anything was written */
    get dirty(): boolean {
        return (
            this.replaced ||
            this.structureChanged ||
            this.nodes.size > 0 ||
            this.parents.size > 0
        );
    }

    /**
     * Builds the new state and updates the index for the touched nodes. `freeze` freezes every new
     * object (the untouched ones are frozen already).
     */
    commit(freeze: boolean): CommitResult {
        if (!this.dirty) {
            return {
                state: this.base,
                index: this.index,
                changed: false,
                removed: [],
            };
        }
        // a layout's active or maximized tabset must be a tabset of that layout
        for (const [layout, record] of this.layouts) {
            if (
                record.active !== undefined &&
                (this.tabset(record.active) === undefined ||
                    this.layoutOf(record.active) !== layout)
            ) {
                record.active = undefined;
            }
            if (
                record.maximized !== undefined &&
                (this.tabset(record.maximized) === undefined ||
                    this.layoutOf(record.maximized) !== layout)
            ) {
                record.maximized = undefined;
            }
        }

        // what left the tree: detached subtrees not attached again, and removed windows
        const removed: string[] = [];
        const removeSubtree = (id: string) => {
            const node = this.get(id);
            if (this.index.has(id) || this.nodes.has(id)) {
                if (this.index.has(id)) {
                    removed.push(id);
                }
                this.index.delete(id);
            }
            if (!node) {
                return;
            }
            for (const child of childrenOf(node)) {
                if (this.parentOf(child.id) === id) {
                    removeSubtree(child.id);
                }
            }
        };
        for (const id of this.detached) {
            if (!this.isAttached(id)) {
                removeSubtree(id);
            }
        }
        for (const [layoutId, root] of this.removedWindows) {
            if (!this.layouts.has(layoutId)) {
                removeSubtree(root);
                this.index.setRoot(root, undefined);
                removed.push(layoutId);
            }
        }

        if (freeze) {
            for (const [id, node] of this.nodes) {
                if (this.isAttached(id)) {
                    deepFreeze(node);
                }
            }
        }

        // the index: every written node, and every moved node, that is in the tree
        for (const [id, node] of this.nodes) {
            if (this.isAttached(id)) {
                this.index.set(id, {
                    node: node as AnyNode,
                    parent: this.parentOf(id),
                });
            }
        }
        for (const [id, parent] of this.parents) {
            const node = this.index.get(id);
            if (!this.nodes.has(id) && node && this.isAttached(id)) {
                this.index.set(id, { node, parent });
            }
        }

        const nodeOf = (id: string): AnyNode => {
            const node = this.get(id);
            if (!node) {
                throw new Error(`Draft.commit: lost node "${id}"`);
            }
            return node;
        };
        const main = this.layouts.get(MAIN_LAYOUT);
        if (!main) {
            throw new Error("Draft.commit: the main layout is missing");
        }
        const root = nodeOf(main.root) as AnyRow;

        const windows: AnyWindow[] = [];
        for (const [id, record] of this.layouts) {
            if (id === MAIN_LAYOUT) {
                continue;
            }
            this.index.setRoot(record.root, id);
            const windowRoot = nodeOf(record.root) as AnyRow;
            const previous = this.baseWindows.get(id);
            if (
                previous &&
                previous.root === windowRoot &&
                previous.active === record.active &&
                previous.maximized === record.maximized &&
                previous.rect === record.rect
            ) {
                windows.push(previous);
                continue;
            }
            const layout: AnyWindow = {
                id,
                rect: record.rect ?? { x: 0, y: 0, width: 0, height: 0 },
                root: windowRoot,
                ...(record.active !== undefined
                    ? { active: record.active }
                    : {}),
                ...(record.maximized !== undefined
                    ? { maximized: record.maximized }
                    : {}),
            };
            windows.push(freeze ? deepFreeze(layout) : layout);
        }
        this.index.setRoot(root.id, MAIN_LAYOUT);

        const borders = this.borderIds.map((id) => nodeOf(id) as AnyBorder);
        const sameBorders =
            borders.length === this.base.borders.length &&
            borders.every((border, i) => border === this.base.borders[i]);
        const sameWindows =
            windows.length === this.base.windows.length &&
            windows.every((layout, i) => layout === this.base.windows[i]);

        const state: AnyState = {
            defaults: this.defaults,
            root,
            ...(main.active !== undefined ? { active: main.active } : {}),
            ...(main.maximized !== undefined
                ? { maximized: main.maximized }
                : {}),
            borders: sameBorders ? this.base.borders : borders,
            windows: sameWindows ? this.base.windows : windows,
        };
        return {
            state: freeze ? deepFreeze(state) : state,
            index: this.index,
            changed: true,
            removed,
        };
    }
}

/** A new, empty tabset of the draft (a fresh id, no tabs). */
export function newTabset(draft: Draft, weight = 100): MutableTabset {
    return draft.create<MutableTabset>({
        type: "tabset",
        id: draft.newId("tabset"),
        weight,
        selected: -1,
        children: [],
    });
}

/** A new, empty row of the draft. */
export function newRow(draft: Draft, weight = 100): MutableRow {
    return draft.create<MutableRow>({
        type: "row",
        id: draft.newId("row"),
        weight,
        children: [],
    });
}

import {
    type AnyTypes,
    type BorderNode,
    type LayoutState,
    MAIN_LAYOUT,
    type Node,
    type RowNode,
    type TabNode,
    type TabsetNode,
    type WindowLayout,
} from "./types";

/** Any node, untyped by a registry (the internal view of the tree). */
export type AnyNode = Node<AnyTypes>;
export type AnyRow = RowNode<AnyTypes>;
export type AnyTabset = TabsetNode<AnyTypes>;
export type AnyTab = TabNode<string, unknown>;
export type AnyBorder = BorderNode<AnyTypes>;
export type AnyWindow = WindowLayout<AnyTypes>;
export type AnyState = LayoutState<AnyTypes>;

/** The children of a node (a tab has none). */
export function childrenOf(node: AnyNode): readonly AnyNode[] {
    return node.type === "tab" ? [] : node.children;
}

/** Calls `fn` for `node` and every node below it, depth first, with each node's parent id. */
export function walk(
    node: AnyNode,
    fn: (node: AnyNode, parent: string | undefined) => void,
    parent?: string,
): void {
    fn(node, parent);
    for (const child of childrenOf(node)) {
        walk(child, fn, node.id);
    }
}

/** Calls `fn` for every node of a state: the main tree, the borders, then each window's tree. */
export function walkState(
    state: AnyState,
    fn: (node: AnyNode, parent: string | undefined, layout: string) => void,
): void {
    walk(state.root, (node, parent) => fn(node, parent, MAIN_LAYOUT));
    for (const border of state.borders) {
        walk(border, (node, parent) => fn(node, parent, MAIN_LAYOUT));
    }
    for (const windowLayout of state.windows) {
        walk(windowLayout.root, (node, parent) =>
            fn(node, parent, windowLayout.id),
        );
    }
}

/** What {@link defaultTabset} reads: the committed state's index, or a draft. */
export interface NodeLookup {
    get(id: string): AnyNode | undefined;
    layoutOf(id: string): string | undefined;
}

/**
 * The tabset to place into when no target is given: the layout's active tabset, else its first in
 * tree order. `rootId` and `activeId` are the layout's root row and active tabset.
 */
export function defaultTabset(
    nodes: NodeLookup,
    layoutId: string,
    rootId: string | undefined,
    activeId: string | undefined,
): string | undefined {
    if (activeId !== undefined && nodes.layoutOf(activeId) === layoutId) {
        return activeId;
    }
    const first = (id: string): string | undefined => {
        const node = nodes.get(id);
        if (node?.type === "tabset") {
            return node.id;
        }
        if (node?.type !== "row") {
            return undefined;
        }
        for (const child of node.children) {
            const found = first(child.id);
            if (found !== undefined) {
                return found;
            }
        }
        return undefined;
    };
    return rootId === undefined ? undefined : first(rootId);
}

export interface IndexEntry {
    readonly node: AnyNode;
    /** the parent's id; undefined for a layout's root row and for a border */
    readonly parent: string | undefined;
}

/**
 * The id index of the current state: O(1) lookup of a node and its parent. The model updates it
 * incrementally on every commit (only the changed and moved nodes), never by walking the tree.
 */
export class NodeIndex {
    private readonly entries = new Map<string, IndexEntry>();
    /** root row id → layout id */
    private readonly roots = new Map<string, string>();

    static build(state: AnyState): NodeIndex {
        const index = new NodeIndex();
        index.roots.set(state.root.id, MAIN_LAYOUT);
        for (const windowLayout of state.windows) {
            index.roots.set(windowLayout.root.id, windowLayout.id);
        }
        walkState(state, (node, parent) => {
            index.entries.set(node.id, { node, parent });
        });
        return index;
    }

    get(id: string): AnyNode | undefined {
        return this.entries.get(id)?.node;
    }

    has(id: string): boolean {
        return this.entries.has(id);
    }

    parent(id: string): string | undefined {
        return this.entries.get(id)?.parent;
    }

    /** the layout a node is in: its root row's, or the main layout for a border's */
    layoutOf(id: string): string | undefined {
        if (!this.entries.has(id)) {
            return undefined;
        }
        let top = id;
        for (
            let parent = this.parent(top);
            parent !== undefined;
            parent = this.parent(top)
        ) {
            top = parent;
        }
        return this.get(top)?.type === "border"
            ? MAIN_LAYOUT
            : this.roots.get(top);
    }

    /** the layout of the root row `id`, if it is one */
    layoutOfRoot(id: string): string | undefined {
        return this.roots.get(id);
    }

    /** @internal */
    set(id: string, entry: IndexEntry): void {
        this.entries.set(id, entry);
    }

    /** @internal */
    delete(id: string): void {
        this.entries.delete(id);
    }

    /** @internal */
    setRoot(rootId: string, layout: string | undefined): void {
        if (layout === undefined) {
            this.roots.delete(rootId);
        } else {
            this.roots.set(rootId, layout);
        }
    }
}

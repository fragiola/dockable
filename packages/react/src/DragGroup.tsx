import {
    DragGroup as CoreDragGroup,
    type TransferListener,
} from "@fragiola/dockable";
import * as React from "react";
import { createPortal } from "react-dom";

/**
 * Where the content of every tab of a drag group renders: one place for all the group's roots,
 * keyed by tab id. A panel registers its content (and the context it needs) here instead of
 * portalling it itself, so a tab moving from one root to another keeps its key, its portal and
 * the state of the components under it.
 */
export class ContentRegistry {
    private readonly entries = new Map<
        string,
        { owner: object; container: HTMLElement; node: React.ReactNode }
    >();
    private readonly removals = new Map<
        string,
        ReturnType<typeof setTimeout>
    >();
    private readonly listeners = new Set<() => void>();
    private version = 0;

    subscribe = (listener: () => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    getSnapshot = () => this.version;

    /** Adds (or updates) the content under `key`; `owner` identifies the panel rendering it. */
    set(
        key: string,
        owner: object,
        container: HTMLElement,
        node: React.ReactNode,
    ) {
        const pending = this.removals.get(key);
        if (pending !== undefined) {
            clearTimeout(pending);
            this.removals.delete(key);
        }
        this.entries.set(key, { owner, container, node });
        this.notify();
    }

    /**
     * Removes the content under `key` if `owner` still renders it. Deferred to the next task: a
     * tab moving to another root unmounts its old panel and mounts the new one, possibly in two
     * commits, and the content must not unmount in between.
     */
    remove(key: string, owner: object) {
        if (this.entries.get(key)?.owner !== owner || this.removals.has(key)) {
            return;
        }
        this.removals.set(
            key,
            setTimeout(() => {
                this.removals.delete(key);
                if (this.entries.get(key)?.owner === owner) {
                    this.entries.delete(key);
                    this.notify();
                }
            }, 0),
        );
    }

    render(): React.ReactNode[] {
        return [...this.entries].map(([key, entry]) =>
            createPortal(entry.node, entry.container, key),
        );
    }

    private notify() {
        this.version++;
        for (const listener of [...this.listeners]) {
            listener();
        }
    }
}

export interface DragGroupContextValue {
    group: CoreDragGroup;
    registry: ContentRegistry;
}

export const DragGroupContext =
    React.createContext<DragGroupContextValue | null>(null);

function ContentHost({ registry }: { registry: ContentRegistry }) {
    React.useSyncExternalStore(
        registry.subscribe,
        registry.getSnapshot,
        registry.getSnapshot,
    );
    return <>{registry.render()}</>;
}

export interface DragGroupProps {
    /** the layouts (`Dockable.Root`s) that exchange tabs, anywhere below */
    children?: React.ReactNode;
    /**
     * called after a tab moved from one layout to another, with where it came from and where it
     * went (what an app's undo needs)
     */
    onTransfer?: TransferListener | undefined;
}

/**
 * Layouts of different models that exchange tabs by drag and drop. Wrap the `Dockable.Root`s in
 * it: a tab dragged from one drops into another (each root's `onAction` can veto), and its
 * content keeps its state. Renders no element of its own.
 */
export function DragGroup(props: DragGroupProps) {
    const { children, onTransfer } = props;
    const [value] = React.useState<DragGroupContextValue>(() => ({
        group: new CoreDragGroup(),
        registry: new ContentRegistry(),
    }));
    const latest = React.useRef(onTransfer);
    latest.current = onTransfer;
    React.useEffect(
        () => value.group.onTransfer((transfer) => latest.current?.(transfer)),
        [value],
    );
    return (
        <DragGroupContext.Provider value={value}>
            {children}
            <ContentHost registry={value.registry} />
        </DragGroupContext.Provider>
    );
}

/**
 * The drag group of the enclosing `Dockable.DragGroup`, for code that moves tabs between its
 * layouts (`group.transfer(…)`, an undo) or listens to transfers.
 */
export function useDragGroup(): CoreDragGroup {
    const context = React.useContext(DragGroupContext);
    if (!context) {
        throw new Error("useDragGroup must be used inside Dockable.DragGroup");
    }
    return context.group;
}

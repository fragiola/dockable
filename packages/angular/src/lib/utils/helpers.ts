import {
    computed,
    DestroyRef,
    ElementRef,
    effect,
    inject,
    type Signal,
    signal,
    untracked,
} from "@angular/core";

/**
 * A `data-*` attribute's value for a host binding: `true` → present (empty), `false` or
 * `undefined` → absent (`null`), never `"false"`.
 */
export function dataAttr(
    value: boolean | string | number | undefined | null,
): string | null {
    if (value === true) {
        return "";
    }
    if (value === false || value === undefined || value === null) {
        return null;
    }
    return String(value);
}

/** A length in pixels for an inline style. */
export function px(value: number | undefined): string | undefined {
    return value === undefined ? undefined : `${value}px`;
}

/** Structural inline style, camelCase keys (`flexGrow`): an undefined value leaves the key alone. */
export type StructuralStyle = Readonly<
    Record<string, string | number | undefined>
>;

const kebab = (key: string) =>
    key.startsWith("--")
        ? key
        : key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/**
 * Applies a part's structural style to its element, and keeps it applied as it changes: the keys
 * it sets win over the consumer's static `style` (the directive writes them after the element is
 * created); a key it stops setting gets the consumer's value back. Every other key of the
 * consumer's style is untouched.
 */
export function bindStructuralStyle(
    element: HTMLElement,
    style: () => StructuralStyle,
): void {
    /** the keys set now, with the consumer's value they replaced */
    const owned = new Map<string, string>();
    effect(() => {
        const next = new Map<string, string>();
        for (const [key, value] of Object.entries(style())) {
            if (value !== undefined) {
                next.set(kebab(key), String(value));
            }
        }
        untracked(() => {
            for (const [name, previous] of owned) {
                if (!next.has(name)) {
                    if (previous === "") {
                        element.style.removeProperty(name);
                    } else {
                        element.style.setProperty(name, previous);
                    }
                    owned.delete(name);
                }
            }
            for (const [name, value] of next) {
                if (!owned.has(name)) {
                    owned.set(name, element.style.getPropertyValue(name));
                }
                if (element.style.getPropertyValue(name) !== value) {
                    element.style.setProperty(name, value);
                }
            }
        });
    });
}

/** A store a part reads: notified on change, read on demand. */
export interface Store<S> {
    subscribe(listener: () => void): () => void;
    getSnapshot(): S;
}

/**
 * A value read from an external store as a signal: it re-reads `read()` whenever the store
 * notifies (and whenever a signal it reads changes). The store itself may change (another engine):
 * `subscribe` is read in a reactive context. The subscription ends with the directive.
 */
export function fromStore<S>(
    subscribe: () => (listener: () => void) => () => void,
    read: () => S,
): Signal<S> {
    const tick = signal(0);
    effect((onCleanup) => {
        const subscribeTo = subscribe();
        onCleanup(
            subscribeTo(() => {
                tick.update((value) => value + 1);
            }),
        );
        // a change between the first read and the subscription is read again
        untracked(() => tick.update((value) => value + 1));
    });
    return computed(() => {
        tick();
        return read();
    });
}

/** The host element of the directive being created. */
export function injectHost(): HTMLElement {
    return inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}

/** Runs `teardown` when the directive (or component) being created is destroyed. */
export function onDestroy(teardown: () => void): void {
    inject(DestroyRef).onDestroy(teardown);
}

/** `true` for a bare attribute (`<div dockableTabList overflow>`), else the value as a boolean. */
export function booleanInput(value: unknown): boolean {
    return value === "" || (value !== "false" && Boolean(value));
}

/** Like {@link booleanInput}, keeping `undefined` (the part's default). */
export function optionalBoolean(value: unknown): boolean | undefined {
    return value === undefined || value === null
        ? undefined
        : booleanInput(value);
}

/**
 * Moves `nodes` right before `anchor` (into `anchor`'s parent), keeping their order; nodes already
 * in place are not touched (moving an attached node drops its focus and its scroll position).
 */
export function moveBefore(nodes: readonly Node[], anchor: Node): void {
    const parent = anchor.parentNode;
    if (!parent) {
        return;
    }
    let cursor = anchor.previousSibling;
    let inPlace = true;
    for (let i = nodes.length - 1; i >= 0; i--) {
        if (nodes[i] !== cursor) {
            inPlace = false;
            break;
        }
        cursor = cursor?.previousSibling ?? null;
    }
    if (inPlace) {
        return;
    }
    for (const node of nodes) {
        parent.insertBefore(node, anchor);
    }
}

/**
 * What `read` returns, or `fallback` while a required input it reads is not set yet. A part's
 * `state()` is read by bindings on its own element (`[class]="styles.tab(part.state())"`), and
 * Angular applies an element's class and style bindings before it sets its directives' inputs: on
 * the first pass the input throws (NG0950). The read still tracks the input, so the computed that
 * calls this runs again once the input is set.
 */
export function beforeInputs<V>(fallback: V, read: () => V): V {
    try {
        return read();
    } catch (error) {
        if ((error as { code?: unknown } | null)?.code === -950)
            return fallback;
        throw error;
    }
}

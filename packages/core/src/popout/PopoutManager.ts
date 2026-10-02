// Ported from FlexLayout (https://github.com/caplin/FlexLayout), src/view/PopoutWindow.tsx (window
// lifecycle) and src/view/layout/FloatingWindowContainer.tsx (URL building),
// with React and class names removed. Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see
// LICENSE.
//
// Differences from FlexLayout:
// - the manager is framework-agnostic and owned by the main engine: it keeps one native window per
//   window layout of the state while the engine is attached (an adapter only portals into the
//   content root once the window is ready);
// - a detach defers the release to a microtask, so a StrictMode unmount/remount keeps the windows;
// - closing the window from the browser runs `window.close`: its tabs dock back into the main
//   layout (FlexLayout's "float" close policy is not kept);
// - the window opener is injectable (`openWindow`);
// - nothing names or titles the window unless the consumer provides a title.
import type { LayoutEngine } from "../engine/LayoutEngine";
import { type Rect, rectEquals } from "../geometry/rect";
import type { AnyTypes, DockableTypes, WindowLayout } from "../state/types";
import { mirrorRootAttributes, StyleMirror } from "./styles";

/** Poll a popout's screen position: a window that moves fires no event. */
export const WINDOW_RECT_POLL_INTERVAL_MS = 1000;
/** Attribute of the element the adapter renders a popout's layout into. */
export const POPOUT_ATTRIBUTE = "data-dockable-popout";

export type PopoutCallback<T extends DockableTypes = AnyTypes> = (
    layout: WindowLayout<T>,
    window: Window,
    document: Document,
) => void;

/** Opens a popout's native window (the main window's `open` by default). */
export type OpenWindow = (
    url: string,
    name: string,
    features: string,
) => Window | null;

export interface PopoutOptions<T extends DockableTypes = AnyTypes> {
    /** the popout host page; default `"popout.html"` */
    popoutURL?: string | undefined;
    /** whether window layouts open as popouts at all; default: a desktop pointer is present */
    supportsPopout?: boolean | undefined;
    /** the popout document's title; with none, the host page's title is kept */
    title?: ((layout: WindowLayout<T>) => string | undefined) | undefined;
    /** the popout document is ready, before its content renders (e.g. to set up a css-in-js cache) */
    onPopoutOpen?: PopoutCallback<T> | undefined;
    /** the popout window is closing */
    onPopoutClose?: PopoutCallback<T> | undefined;
    /**
     * copies the main document's `<html>` and `<body>` attributes into each popout and keeps them
     * in sync: `true` copies them all (except `style`, `id` and `dir`), a list copies those names
     * only. Default: only `lang` of `<html>`. A popout's `dir` is always the layout's direction.
     */
    mirrorRoot?: boolean | readonly string[] | undefined;
    /** opens the native window (default: the main window's `open`) */
    openWindow?: OpenWindow | undefined;
}

interface PopoutEntry<T extends DockableTypes> {
    layoutId: string;
    window: Window;
    engine: LayoutEngine<T>;
    /** the element the adapter renders into, once the window loaded and the styles are copied */
    contentRoot: HTMLElement | undefined;
    /** releases the current document's observer, poll timer and listeners */
    cleanup: (() => void) | undefined;
}

/** true when the main window has a fine hover pointer (FlexLayout's `isDesktop`) */
export function isDesktop(win: Window | undefined): boolean {
    return !!win?.matchMedia?.("(hover: hover) and (pointer: fine)").matches;
}

/**
 * Opens, mirrors and closes the native windows of a model's window layouts. One per main engine:
 * while the engine is attached, every window layout of the state has a window, and a window whose
 * layout left the state closes. An adapter renders a window layout into {@link getContentRoot}
 * once ready, with {@link getLayoutEngine} as that layout's engine.
 */
export class PopoutManager<T extends DockableTypes = AnyTypes> {
    // a named window is shared: a new manager's open(url, layoutId) returns (and reloads) the window
    // a previous manager opened. Only the current owner may close it or react to its unload.
    private static readonly owners = new WeakMap<Window, object>();
    private readonly engine: LayoutEngine<T>;
    private options: PopoutOptions<T> = {};
    private readonly entries = new Map<string, PopoutEntry<T>>();
    private readonly listeners = new Set<() => void>();
    private revision = 0;
    private removeMainUnload: (() => void) | undefined;
    private attached = false;

    constructor(engine: LayoutEngine<T>) {
        this.engine = engine;
    }

    setOptions(options: PopoutOptions<T>) {
        this.options = options;
    }

    /** the popout host page */
    getPopoutURL(): string {
        return this.options.popoutURL ?? "popout.html";
    }

    /** whether window layouts open as native popouts */
    isSupportsPopout(): boolean {
        return (
            this.options.supportsPopout ??
            isDesktop(this.engine.get("owner-window"))
        );
    }

    /** Calls `listener` when a window opens, becomes ready or closes. */
    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    /** A number that changes whenever a window opens, becomes ready or closes. */
    getSnapshot = (): number => this.revision;

    private notify() {
        this.revision++;
        for (const listener of [...this.listeners]) {
            listener();
        }
    }

    /** the element to render the window layout into, once its window is ready */
    getContentRoot(layoutId: string): HTMLElement | undefined {
        return this.entries.get(layoutId)?.contentRoot;
    }

    /** the engine of a window layout (created when its window opens) */
    getLayoutEngine(layoutId: string): LayoutEngine<T> | undefined {
        return this.entries.get(layoutId)?.engine;
    }

    /** the native window of a window layout */
    getWindow(layoutId: string): Window | undefined {
        return this.entries.get(layoutId)?.window;
    }

    /** the ids of the layouts with an open window */
    getOpenLayoutIds(): string[] {
        return [...this.entries.keys()];
    }

    /** The main engine attached: opens the windows of the state's window layouts. */
    attach() {
        this.attached = true;
        this.sync();
    }

    /**
     * The main engine detached: the windows close after the current task, unless the engine is
     * attached again in the meantime (a StrictMode remount keeps them).
     */
    detach() {
        this.attached = false;
        queueMicrotask(() => {
            if (!this.attached) {
                this.closeAll();
            }
        });
    }

    /** Opens a window for every window layout without one and closes those whose layout is gone. */
    sync() {
        if (!this.attached) {
            return;
        }
        const layouts = this.engine.adapter.model.state.windows;
        for (const layoutId of [...this.entries.keys()]) {
            if (!layouts.some((layout) => layout.id === layoutId)) {
                this.close(layoutId);
            }
        }
        for (const layout of layouts) {
            if (!this.entries.has(layout.id)) {
                this.open(layout);
            }
        }
    }

    /** Opens the window of a window layout (idempotent per layout id). */
    private open(layout: WindowLayout<T>) {
        const layoutId = layout.id;
        const mainWindow = this.engine.get("owner-window");
        if (!mainWindow) {
            return; // opened once the engine is attached to a window
        }
        if (!this.isSupportsPopout()) {
            // no native windows here: the window layout's tabs go back to the main layout
            this.dockBack(layoutId);
            return;
        }
        const rect = layout.rect;
        const url = `${this.getPopoutURL()}?id=${encodeURIComponent(layoutId)}`;
        const features = `left=${rect.x},top=${rect.y},width=${rect.width},height=${rect.height}`;
        const opener: OpenWindow =
            this.options.openWindow ??
            ((u, name, f) => mainWindow.open(u, name, f));
        // the name is scoped: two models on one page may both have a "window-1"
        const popout = opener(
            url,
            `dockable-${this.engine.adapter.idScope}${layoutId}`,
            features,
        );
        if (!popout) {
            console.warn(`Unable to open window ${url}`);
            this.dockBack(layoutId);
            return;
        }
        const engine = this.engine.adapter.createPopoutEngine(layoutId);
        const entry: PopoutEntry<T> = {
            layoutId,
            window: popout,
            engine,
            contentRoot: undefined,
            cleanup: undefined,
        };
        this.entries.set(layoutId, entry);
        PopoutManager.owners.set(popout, this);
        this.watchMainUnload(mainWindow);
        popout.addEventListener("load", () => this.onLoad(entry));
        this.notify();
    }

    /** runs `window.close` for a window layout (its tabs dock back into the main layout) */
    private dockBack(layoutId: string) {
        if (this.layoutOf(layoutId)) {
            this.engine.adapter.model.run("window.close", {
                windowId: layoutId,
            });
        }
    }

    /** The main layout's direction changed: every window takes it (their engines re-measure). */
    followDirection() {
        const direction = this.engine.get("direction");
        for (const entry of this.entries.values()) {
            if (entry.cleanup) {
                entry.window.document.documentElement.dir = direction;
            }
        }
    }

    /** Closes a layout's window now (the layout stays in the state). */
    close(layoutId: string) {
        const entry = this.entries.get(layoutId);
        if (!entry) {
            return;
        }
        this.entries.delete(layoutId);
        entry.cleanup?.();
        entry.engine.adapter.dispose();
        if (PopoutManager.owners.get(entry.window) === this) {
            PopoutManager.owners.delete(entry.window);
            try {
                entry.window.close();
            } catch {
                // a window that is already gone
            }
        }
        if (this.entries.size === 0) {
            this.removeMainUnload?.();
        }
        this.notify();
    }

    private closeAll() {
        for (const layoutId of [...this.entries.keys()]) {
            this.close(layoutId);
        }
    }

    /** Closes every window and releases every resource. */
    dispose() {
        this.attached = false;
        this.closeAll();
        this.listeners.clear();
    }

    // the main window unloading closes every popout (pagehide, not beforeunload: another
    // beforeunload handler may still cancel the unload)
    private watchMainUnload(mainWindow: Window) {
        if (this.removeMainUnload) {
            return;
        }
        const onUnload = () => this.closeAll();
        mainWindow.addEventListener("pagehide", onUnload);
        this.removeMainUnload = () => {
            mainWindow.removeEventListener("pagehide", onUnload);
            this.removeMainUnload = undefined;
        };
    }

    private layoutOf(layoutId: string): WindowLayout<T> | undefined {
        return this.engine.adapter.model.get("window-by", {
            id: layoutId,
        });
    }

    /** the entry is still the one open for its layout (not closed, not replaced) */
    private isCurrent(entry: PopoutEntry<T>): boolean {
        return this.entries.get(entry.layoutId) === entry;
    }

    private onLoad(entry: PopoutEntry<T>) {
        const layout = this.layoutOf(entry.layoutId);
        if (!this.isCurrent(entry) || !layout) {
            return;
        }
        // a reload of the popout re-fires load on the same Window: release the previous document's
        // observer/timer/handler before re-initializing
        entry.cleanup?.();
        entry.cleanup = undefined;
        entry.contentRoot = undefined;

        const popout = entry.window;
        const mainDocument = this.engine.get("owner-document");
        if (!mainDocument) {
            return;
        }
        popout.focus();
        placeWindow(popout, layout.rect);

        const popoutDocument = popout.document;
        const title = this.options.title?.(layout);
        if (title !== undefined) {
            popoutDocument.title = title;
        }
        // carry over the language and the root attributes the consumer asked to mirror; the
        // direction is the layout's, wherever the page sets it
        const stopMirroringRoot = mirrorRootAttributes(
            mainDocument,
            popoutDocument,
            this.options.mirrorRoot,
        );
        popoutDocument.documentElement.dir = this.engine.get("direction");
        const contentRoot = popoutDocument.createElement("div");
        contentRoot.setAttribute(POPOUT_ATTRIBUTE, entry.layoutId);
        popoutDocument.body.appendChild(contentRoot);
        this.options.onPopoutOpen?.(layout, popout, popoutDocument);

        const mirror = new StyleMirror(mainDocument, popoutDocument);
        mirror.copyStyles().then(() => {
            if (this.isCurrent(entry) && popout.document === popoutDocument) {
                entry.contentRoot = contentRoot; // render once the link styles loaded
                this.notify();
                // the content just mounted, so css-in-js libraries have inserted their rules for it
                queueMicrotask(() => mirror.resyncStyles());
            }
        });
        const stopTracking = this.trackWindowRect(entry);
        const stopUnload = this.onPopoutUnload(entry, popoutDocument);
        entry.cleanup = () => {
            stopMirroringRoot();
            mirror.dispose();
            stopTracking();
            stopUnload();
        };
    }

    /**
     * records where the window is, so a saved layout reopens it in place: on resize, and by
     * polling, since a window that only moves fires no event. Returns the function that stops.
     */
    private trackWindowRect(entry: PopoutEntry<T>): () => void {
        const popout = entry.window;
        const onResize = () => {
            const current = this.layoutOf(entry.layoutId);
            if (
                !this.isCurrent(entry) ||
                !current ||
                popout.screenTop <= -10000
            ) {
                return; // chrome reports large negative values while minimized
            }
            const rect = {
                x: popout.screenLeft,
                y: popout.screenTop,
                width: popout.outerWidth,
                height: popout.outerHeight,
            };
            if (!rectEquals(rect, current.rect)) {
                this.engine.adapter.model.run(
                    "window.configure",
                    { windowId: entry.layoutId, rect },
                    { transient: true },
                );
            }
        };
        popout.addEventListener("resize", onResize);
        const poll = popout.setInterval(onResize, WINDOW_RECT_POLL_INTERVAL_MS);
        return () => {
            popout.removeEventListener("resize", onResize);
            popout.clearInterval(poll);
        };
    }

    /**
     * closing the window from the browser docks its tabs back (listened to after load, for
     * safari). Returns the function that stops listening.
     */
    private onPopoutUnload(
        entry: PopoutEntry<T>,
        popoutDocument: Document,
    ): () => void {
        const popout = entry.window;
        const onBeforeUnload = () => {
            if (!this.isCurrent(entry)) {
                return;
            }
            if (PopoutManager.owners.get(popout) !== this) {
                // another manager took the window over: let go quietly
                this.close(entry.layoutId);
                return;
            }
            const current = this.layoutOf(entry.layoutId);
            if (current) {
                this.options.onPopoutClose?.(current, popout, popoutDocument);
            }
            this.rescueContent(entry.layoutId);
            this.close(entry.layoutId);
            this.dockBack(entry.layoutId);
        };
        popout.addEventListener("beforeunload", onBeforeUnload);
        return () => popout.removeEventListener("beforeunload", onBeforeUnload);
    }

    /**
     * moves the moveable elements of a closing window's tabs into the main document right away,
     * so their content (and the framework state rendered into it) outlives the window
     */
    private rescueContent(layoutId: string) {
        for (const tab of this.engine.adapter.model.get("tabs", {
            layoutId,
        })) {
            this.engine.adapter.releaseMoveable(tab.id);
        }
    }
}

/**
 * Moves and sizes a popout window to `rect`, converging on the metrics a saved rect is read with
 * (screenLeft/Top, outerWidth/Height): browsers disagree on the reference points of resizeTo and
 * moveTo, so the reported difference is corrected.
 */
function placeWindow(popout: Window, rect: Rect) {
    // resizeTo must be before moveTo in chrome, otherwise the window ends up at 0,0
    popout.resizeTo(rect.width, rect.height);
    popout.moveTo(rect.x, rect.y);
    popout.resizeBy(
        rect.width - popout.outerWidth,
        rect.height - popout.outerHeight,
    );
    popout.moveBy(rect.x - popout.screenLeft, rect.y - popout.screenTop);
}

// Ported from FlexLayout (https://github.com/caplin/FlexLayout), src/view/PopoutWindow.tsx (window
// lifecycle and style mirroring) and src/view/layout/FloatingWindowContainer.tsx (URL building),
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
// - adoptedStyleSheets (constructable stylesheets) are mirrored too;
// - nothing names or titles the window unless the consumer provides a title.
import type { LayoutEngine } from "../engine/LayoutEngine";
import type { AnyTypes, DockableTypes, WindowLayout } from "../state/types";

/** Timeout for blocked stylesheets. */
export const STYLE_LOAD_TIMEOUT_MS = 2000;
/** Poll CSSOM rules (MutationObserver misses insertRule). */
export const STYLE_POLL_INTERVAL_MS = 750;
/** Poll a popout's screen position: a window that moves fires no event. */
export const WINDOW_RECT_POLL_INTERVAL_MS = 1000;
/** Attribute of the element the adapter renders a popout's layout into. */
export const POPOUT_ATTRIBUTE = "data-dockable-popout";
/** Attribute of the style element mirroring the main document's adopted stylesheets. */
export const ADOPTED_STYLES_ATTRIBUTE = "data-dockable-adopted-styles";

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
     * in sync: `true` copies them all (except `style` and `id`), a list copies those names only.
     * Default: only `lang` and `dir` of `<html>`.
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
    closing: boolean;
}

/** true when the main window has a fine hover pointer (FlexLayout's `isDesktop`) */
export function isDesktop(win: Window | undefined): boolean {
    return !!win?.matchMedia?.("(hover: hover) and (pointer: fine)").matches;
}

const isLink = (element: Element): element is HTMLLinkElement =>
    element.tagName === "LINK";
const isStylesheetLink = (element: Element): element is HTMLLinkElement =>
    isLink(element) &&
    (element.getAttribute("rel") ?? "").split(/\s+/).includes("stylesheet");
const isStyle = (element: Element): element is HTMLStyleElement =>
    element.tagName === "STYLE";

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
    private releaseToken: object | undefined;

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
        this.releaseToken = undefined; // a pending release (a StrictMode remount) is cancelled
        this.sync();
    }

    /**
     * The main engine detached: the windows close after the current task, unless the engine is
     * attached again in the meantime (a StrictMode remount keeps them).
     */
    detach() {
        this.attached = false;
        const token = {};
        this.releaseToken = token;
        queueMicrotask(() => {
            if (this.releaseToken === token && !this.attached) {
                for (const layoutId of [...this.entries.keys()]) {
                    this.close(layoutId);
                }
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
        if (this.entries.has(layoutId)) {
            return;
        }
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
            closing: false,
        };
        this.entries.set(layoutId, entry);
        PopoutManager.owners.set(popout, this);
        this.watchMainUnload(mainWindow);
        popout.addEventListener("load", () => this.onLoad(entry));
        this.notify();
    }

    /** runs `window.close` for a window layout (its tabs dock back into the main layout) */
    private dockBack(layoutId: string) {
        if (
            this.engine.adapter.model.state.windows.some(
                (layout) => layout.id === layoutId,
            )
        ) {
            this.engine.adapter.model.run("window.close", { window: layoutId });
        }
    }

    /** Closes a layout's window now (the layout stays in the state). */
    close(layoutId: string) {
        const entry = this.entries.get(layoutId);
        if (!entry) {
            return;
        }
        entry.closing = true; // the window's beforeunload must not dock the layout back
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

    /** Closes every window and releases every resource. */
    dispose() {
        this.attached = false;
        for (const layoutId of [...this.entries.keys()]) {
            this.close(layoutId);
        }
        this.removeMainUnload?.();
        this.listeners.clear();
    }

    // the main window unloading closes every popout (pagehide, not beforeunload: another
    // beforeunload handler may still cancel the unload)
    private watchMainUnload(mainWindow: Window) {
        if (this.removeMainUnload) {
            return;
        }
        const onUnload = () => {
            for (const layoutId of [...this.entries.keys()]) {
                this.close(layoutId);
            }
        };
        mainWindow.addEventListener("pagehide", onUnload);
        this.removeMainUnload = () => {
            mainWindow.removeEventListener("pagehide", onUnload);
            this.removeMainUnload = undefined;
        };
    }

    private layoutOf(layoutId: string): WindowLayout<T> | undefined {
        return this.engine.adapter.model.get("window", { window: layoutId });
    }

    private onLoad(entry: PopoutEntry<T>) {
        const layout = this.layoutOf(entry.layoutId);
        if (this.entries.get(entry.layoutId) !== entry || !layout) {
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

        const rect = layout.rect;
        // note: resizeTo must be before moveTo in chrome otherwise the window ends up at 0,0
        popout.resizeTo(rect.width, rect.height);
        popout.moveTo(rect.x, rect.y);
        // converge on the metrics used when saving (screenLeft/Top, outerWidth/Height): browsers
        // disagree on the reference points of resizeTo/moveTo, so correct by the reported difference
        popout.resizeBy(
            rect.width - popout.outerWidth,
            rect.height - popout.outerHeight,
        );
        popout.moveBy(rect.x - popout.screenLeft, rect.y - popout.screenTop);

        const popoutDocument = popout.document;
        const title = this.options.title?.(layout);
        if (title !== undefined) {
            popoutDocument.title = title;
        }
        // carry over the language/direction, and the root attributes the consumer asked to mirror
        const stopMirroringRoot = mirrorRootAttributes(
            mainDocument,
            popoutDocument,
            this.options.mirrorRoot,
        );
        const contentRoot = popoutDocument.createElement("div");
        contentRoot.setAttribute(POPOUT_ATTRIBUTE, entry.layoutId);
        popoutDocument.body.appendChild(contentRoot);
        this.options.onPopoutOpen?.(layout, popout, popoutDocument);

        const mirror = new StyleMirror(mainDocument, popoutDocument);
        mirror.copyStyles().then(() => {
            if (
                this.entries.get(entry.layoutId) === entry &&
                popout.document === popoutDocument
            ) {
                entry.contentRoot = contentRoot; // render once the link styles loaded
                this.notify();
                // the content just mounted, so css-in-js libraries have inserted their rules for it
                queueMicrotask(() => mirror.resyncStyles());
            }
        });

        // record where the window is, so a saved layout reopens it in place: on resize, and by
        // polling, since a window that only moves fires no event
        const onResize = () => {
            const current = this.layoutOf(entry.layoutId);
            if (
                this.entries.get(entry.layoutId) !== entry ||
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
            if (
                rect.x === current.rect.x &&
                rect.y === current.rect.y &&
                rect.width === current.rect.width &&
                rect.height === current.rect.height
            ) {
                return;
            }
            this.engine.adapter.model.run(
                "window.configure",
                { window: entry.layoutId, rect },
                { transient: true },
            );
        };
        popout.addEventListener("resize", onResize);
        const rectPoll = popout.setInterval(
            onResize,
            WINDOW_RECT_POLL_INTERVAL_MS,
        );

        // listen for the popout unloading (needs to be after load for safari)
        const onPopoutBeforeUnload = () => {
            if (entry.closing || this.entries.get(entry.layoutId) !== entry) {
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
        popout.addEventListener("beforeunload", onPopoutBeforeUnload);

        entry.cleanup = () => {
            stopMirroringRoot();
            mirror.dispose();
            popout.removeEventListener("resize", onResize);
            popout.clearInterval(rectPoll);
            popout.removeEventListener("beforeunload", onPopoutBeforeUnload);
        };
    }

    /**
     * moves the moveable elements of a closing window's tabs into the main document right away,
     * so their content (and the framework state rendered into it) outlives the window
     */
    private rescueContent(layoutId: string) {
        for (const tab of this.engine.adapter.model.get("tabs", {
            layout: layoutId,
        })) {
            this.engine.adapter.releaseMoveable(tab.id);
        }
    }
}

/**
 * Copies the main document's stylesheets into a popout document and keeps them in sync: `<link>`
 * and `<style>` elements (added, removed, or with text edited in place), CSSOM rules inserted by
 * css-in-js libraries (polled), and adopted (constructable) stylesheets.
 */
export class StyleMirror {
    private readonly source: Document;
    private readonly target: Document;
    // map from main doc style -> this doc's equivalent style
    private readonly styleMap = new Map<HTMLElement, HTMLElement>();
    // per-source css rule count, to only re-sync css-in-js tags whose rules actually changed
    private readonly lastRuleCount = new Map<HTMLElement, number>();
    private adoptedClone: HTMLStyleElement | undefined;
    private lastAdoptedSignature = "";
    private lastAdoptedSheets: readonly CSSStyleSheet[] = [];
    private lastAdoptedShape = "";
    private observer: MutationObserver | undefined;
    private pollTimer: number | undefined;

    constructor(source: Document, target: Document) {
        this.source = source;
        this.target = target;
    }

    /** the styles copied so far, main document element → popout element */
    getStyleMap(): ReadonlyMap<HTMLElement, HTMLElement> {
        return this.styleMap;
    }

    /**
     * Copies every stylesheet, then starts mirroring changes. Resolves once the linked stylesheets
     * loaded (or failed, or timed out: a blocked stylesheet must not keep the popout blank).
     */
    copyStyles(): Promise<boolean[]> {
        const promises: Promise<boolean>[] = [];
        for (const element of this.source.querySelectorAll<HTMLElement>(
            'style, link[rel="stylesheet"]',
        )) {
            this.copyStyle(element, promises);
        }
        this.syncAdopted();

        // listen for style mutations. subtree + characterData so we also catch css-in-js libraries
        // (styled-components, emotion) mutating the text of an existing <style> in place - a
        // childList-only observer would miss those and leave the popout with stale styles. (rules
        // inserted purely via the CSSOM sheet.insertRule api are not observable at all.)
        const View = this.source.defaultView;
        if (View?.MutationObserver) {
            this.observer = new View.MutationObserver((mutations) =>
                this.handleStyleMutations(mutations),
            );
            this.observer.observe(this.source.head, {
                childList: true,
                subtree: true,
                characterData: true,
            });
        }
        // poll the copied css-in-js style tags (and adopted sheets) for CSSOM rule changes the
        // observer cannot see, and re-sync any that changed
        this.pollTimer = this.target.defaultView?.setInterval(
            () => this.resyncChangedStyles(),
            STYLE_POLL_INTERVAL_MS,
        );
        return Promise.all(promises);
    }

    /** stops mirroring */
    dispose() {
        this.observer?.disconnect();
        this.observer = undefined;
        if (this.pollTimer !== undefined) {
            this.target.defaultView?.clearInterval(this.pollTimer);
            this.pollTimer = undefined;
        }
    }

    handleStyleMutations(mutations: MutationRecord[]) {
        for (const mutation of mutations) {
            if (
                mutation.type === "childList" &&
                mutation.target === this.source.head
            ) {
                // style/link nodes added to or removed from the head
                for (const addition of mutation.addedNodes) {
                    if (
                        addition.nodeType === 1 &&
                        (isStylesheetLink(addition as Element) ||
                            isStyle(addition as Element))
                    ) {
                        this.copyStyle(addition as HTMLElement);
                    }
                }
                for (const removal of mutation.removedNodes) {
                    const popoutStyle = this.styleMap.get(
                        removal as HTMLElement,
                    );
                    if (popoutStyle) {
                        popoutStyle.remove();
                        this.styleMap.delete(removal as HTMLElement);
                        this.lastRuleCount.delete(removal as HTMLElement);
                    }
                }
            } else {
                // a mutation inside an existing <style> (css-in-js updating its text): re-sync the
                // owning style's current text (or css rules) into its clone in the popout
                const styleElement = findOwningStyle(mutation.target);
                const clone = styleElement && this.styleMap.get(styleElement);
                if (styleElement && clone) {
                    syncStyleElement(styleElement, clone as HTMLStyleElement);
                }
            }
        }
    }

    private copyStyle(element: HTMLElement, promises?: Promise<boolean>[]) {
        if (isLink(element)) {
            // prefer links since they will keep paths to images etc
            const linkElement = this.target.importNode(element, true);
            this.target.head.appendChild(linkElement);
            this.styleMap.set(element, linkElement);

            if (promises) {
                promises.push(
                    new Promise((resolve) => {
                        // resolve on error and after a timeout as well as on load: if a stylesheet is
                        // blocked (CSP/adblock), 404s, or never fires load, the aggregate promise must
                        // still settle - otherwise the content never renders and the popout stays blank
                        let settled = false;
                        const done = (loaded: boolean) => {
                            if (!settled) {
                                settled = true;
                                resolve(loaded);
                            }
                        };
                        linkElement.addEventListener("load", () => done(true));
                        linkElement.addEventListener("error", () =>
                            done(false),
                        );
                        this.target.defaultView?.setTimeout(
                            () => done(false),
                            STYLE_LOAD_TIMEOUT_MS,
                        );
                    }),
                );
            }
        } else if (isStyle(element)) {
            try {
                const styleElement = this.target.importNode(element, true);
                this.target.head.appendChild(styleElement);
                syncStyleElement(element, styleElement);
                this.styleMap.set(element, styleElement);
            } catch {
                // can throw an exception
            }
        }
    }

    /** re-sync every copied style tag */
    resyncStyles() {
        for (const [source, clone] of this.styleMap) {
            if (isStyle(source)) {
                syncStyleElement(source, clone as HTMLStyleElement);
            }
        }
        this.syncAdopted();
    }

    /** re-sync the css-in-js (CSSOM-inserted) style tags whose rule count changed */
    resyncChangedStyles() {
        for (const [source, clone] of this.styleMap) {
            if (!isStyle(source) || (source.textContent ?? "").trim() !== "") {
                continue;
            }
            let count = 0;
            try {
                count = source.sheet?.cssRules.length ?? 0;
            } catch {
                // unreadable sheet
            }
            if (count !== this.lastRuleCount.get(source)) {
                this.lastRuleCount.set(source, count);
                syncStyleElement(source, clone as HTMLStyleElement);
            }
        }
        this.syncAdopted();
    }

    /**
     * mirrors the main document's adopted (constructable) stylesheets: they cannot be shared with
     * another document, so their rules are copied into a single style element
     */
    private syncAdopted() {
        const sheets = this.source.adoptedStyleSheets ?? [];
        // serialize only when the set of sheets or their rule counts changed
        let shape = "";
        for (const sheet of sheets) {
            let count = -1;
            try {
                count = sheet.cssRules.length;
            } catch {
                // unreadable rules are ignored
            }
            shape += `${count},`;
        }
        if (
            sheets.length === this.lastAdoptedSheets.length &&
            sheets.every((sheet, i) => sheet === this.lastAdoptedSheets[i]) &&
            shape === this.lastAdoptedShape
        ) {
            return;
        }
        this.lastAdoptedSheets = [...sheets];
        this.lastAdoptedShape = shape;
        let css = "";
        for (const sheet of sheets) {
            try {
                for (const rule of sheet.cssRules) {
                    css += `${rule.cssText}\n`;
                }
            } catch {
                // unreadable rules are ignored
            }
        }
        if (css === this.lastAdoptedSignature) {
            return;
        }
        this.lastAdoptedSignature = css;
        if (!this.adoptedClone) {
            this.adoptedClone = this.target.createElement("style");
            this.adoptedClone.setAttribute(ADOPTED_STYLES_ATTRIBUTE, "");
            this.target.head.appendChild(this.adoptedClone);
        }
        this.adoptedClone.textContent = css;
    }
}

function findOwningStyle(node: globalThis.Node): HTMLStyleElement | undefined {
    let element: globalThis.Node | null =
        node.nodeType === 1 ? node : node.parentNode;
    while (
        element &&
        !(element.nodeType === 1 && isStyle(element as Element))
    ) {
        element = element.parentNode;
    }
    return element ? (element as HTMLStyleElement) : undefined;
}

/**
 * sync the source <style>'s rules into the popout clone. css-in-js libraries (emotion,
 * styled-components) insert rules through the CSSOM sheet.insertRule api in production ("speedy"
 * mode), leaving textContent empty - a clone would be blank, so rebuild the clone from the sheet's
 * css rules in that case
 */
function syncStyleElement(source: HTMLStyleElement, clone: HTMLStyleElement) {
    const text = source.textContent ?? "";
    if (text.trim() !== "") {
        clone.textContent = text;
    } else {
        try {
            clone.textContent = "";
            const rules = source.sheet?.cssRules;
            const sheet = clone.sheet;
            if (rules && sheet) {
                for (const rule of rules) {
                    sheet.insertRule(rule.cssText, sheet.cssRules.length);
                }
            }
        } catch {
            // cross-origin sheets or unreadable rules are ignored
        }
    }
}

/** Attributes never mirrored with `mirrorRoot: true`: they belong to each document. */
const UNMIRRORED = new Set(["style", "id"]);

/**
 * Copies `<html>` and `<body>` attributes from `source` to `target` and keeps them in sync until the
 * returned function is called. `lang` and `dir` of `<html>` are always copied.
 */
export function mirrorRootAttributes(
    source: Document,
    target: Document,
    mirror: boolean | readonly string[] | undefined,
): () => void {
    const pairs: [Element, Element][] = [
        [source.documentElement, target.documentElement],
        [source.body, target.body],
    ];
    const listed = Array.isArray(mirror) ? new Set(mirror) : undefined;
    const mirrored = (element: Element, name: string) => {
        if (
            element === source.documentElement &&
            (name === "lang" || name === "dir")
        ) {
            return true;
        }
        if (mirror === true) {
            return !UNMIRRORED.has(name);
        }
        return listed?.has(name) ?? false;
    };
    const copy = (from: Element, to: Element, name: string) => {
        const value = from.getAttribute(name);
        if (name === "class") {
            // keep the popout's own classes: add the mirrored ones on top (the observer removes
            // the ones the main document drops, one by one)
            for (const cls of (value ?? "").split(/\s+/).filter(Boolean)) {
                to.classList.add(cls);
            }
        } else if (value === null) {
            to.removeAttribute(name);
        } else {
            to.setAttribute(name, value);
        }
    };
    for (const [from, to] of pairs) {
        for (const { name } of Array.from(from.attributes)) {
            if (mirrored(from, name)) copy(from, to, name);
        }
    }
    const view = source.defaultView;
    if (!mirror || !view?.MutationObserver) {
        return () => {};
    }
    const observer = new view.MutationObserver((records) => {
        for (const record of records) {
            const name = record.attributeName;
            const from = record.target as Element;
            const pair = pairs.find(([element]) => element === from);
            if (!name || !pair || !mirrored(from, name)) continue;
            if (name === "class") {
                // a class removed from the main document goes from the popout too
                const before = new Set(
                    (record.oldValue ?? "").split(/\s+/).filter(Boolean),
                );
                const now = new Set(from.classList);
                for (const cls of before) {
                    if (!now.has(cls)) pair[1].classList.remove(cls);
                }
            }
            copy(from, pair[1], name);
        }
    });
    for (const [from] of pairs) {
        observer.observe(from, { attributes: true, attributeOldValue: true });
    }
    return () => observer.disconnect();
}

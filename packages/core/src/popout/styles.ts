// Ported from FlexLayout (https://github.com/caplin/FlexLayout), src/view/PopoutWindow.tsx (style
// mirroring), with React and class names removed. Copyright (c) 2017 Caplin Systems Ltd. MIT
// licence, see LICENSE.
//
// Differences from FlexLayout:
// - adoptedStyleSheets (constructable stylesheets) are mirrored too.
import { elementOf } from "../dom/nodes";

/** Timeout for blocked stylesheets. */
export const STYLE_LOAD_TIMEOUT_MS = 2000;
/** Poll CSSOM rules (MutationObserver misses insertRule). */
export const STYLE_POLL_INTERVAL_MS = 750;
/** Attribute of the style element mirroring the main document's adopted stylesheets. */
export const ADOPTED_STYLES_ATTRIBUTE = "data-dockable-adopted-styles";

const isLink = (element: Element): element is HTMLLinkElement =>
    element.tagName === "LINK";
const isStylesheetLink = (element: Element): element is HTMLLinkElement =>
    isLink(element) &&
    (element.getAttribute("rel") ?? "").split(/\s+/).includes("stylesheet");
const isStyle = (element: Element): element is HTMLStyleElement =>
    element.tagName === "STYLE";

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

    /**
     * Copies every stylesheet, then starts mirroring changes. Resolves once the linked stylesheets
     * loaded (or failed, or timed out: a blocked stylesheet must not keep the popout blank).
     */
    copyStyles(): Promise<boolean[]> {
        const loaded: Promise<boolean>[] = [];
        for (const element of this.source.head.querySelectorAll<HTMLElement>(
            'style, link[rel~="stylesheet"]',
        )) {
            const copy = this.copyStyle(element);
            if (copy && isLink(copy)) {
                loaded.push(this.linkLoaded(copy));
            }
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
        return Promise.all(loaded);
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

    private handleStyleMutations(mutations: MutationRecord[]) {
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
                const styleElement = elementOf(mutation.target)?.closest(
                    "style",
                );
                const clone = styleElement && this.styleMap.get(styleElement);
                if (styleElement && clone) {
                    syncStyleElement(styleElement, clone as HTMLStyleElement);
                }
            }
        }
    }

    /**
     * resolves once a copied link loaded (true), failed or timed out: a stylesheet that is blocked
     * (CSP/adblock), 404s, or never fires load must not keep the popout blank
     */
    private linkLoaded(link: HTMLLinkElement): Promise<boolean> {
        return new Promise((resolve) => {
            link.addEventListener("load", () => resolve(true));
            link.addEventListener("error", () => resolve(false));
            this.target.defaultView?.setTimeout(
                () => resolve(false),
                STYLE_LOAD_TIMEOUT_MS,
            );
        });
    }

    /** copies one `<link>` or `<style>` into the popout; returns the copy */
    private copyStyle(element: HTMLElement): HTMLElement | undefined {
        if (isLink(element)) {
            // prefer links since they will keep paths to images etc
            const linkElement = this.target.importNode(element, true);
            this.target.head.appendChild(linkElement);
            this.styleMap.set(element, linkElement);
            return linkElement;
        }
        if (isStyle(element)) {
            try {
                const styleElement = this.target.importNode(element, true);
                this.target.head.appendChild(styleElement);
                syncStyleElement(element, styleElement);
                this.styleMap.set(element, styleElement);
                return styleElement;
            } catch {
                // can throw an exception
            }
        }
        return undefined;
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

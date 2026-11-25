/**
 * The element a DOM node or event target is, or the element that holds it: a text node's parent
 * (a mutation inside a `<style>`, a dragged text selection), and null for anything else (a
 * window, a detached text node). Reads `nodeType`, so it works across documents and windows.
 */
export function elementOf(target: EventTarget | Node | null): Element | null {
    const node = target as Node | null;
    if (typeof node?.nodeType !== "number") {
        return null;
    }
    return node.nodeType === 1 ? (node as Element) : node.parentElement;
}

/**
 * Whether an event target is a text editing context: an `input`, `textarea` or `select` (or
 * inside one), or editable content (`contenteditable`). Keys and drags from such a target belong
 * to the editor, not to the layout part that holds it.
 */
export function isEditable(target: EventTarget | Node | null): boolean {
    const element = elementOf(target);
    if (!element) {
        return false;
    }
    if (element.closest("input, textarea, select")) {
        return true;
    }
    return (element as HTMLElement).isContentEditable === true;
}

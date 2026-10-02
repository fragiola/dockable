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

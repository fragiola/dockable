/** Test helpers for the Angular tests: elements by layout path, and native events. */

export const path = (p: string) =>
    document.querySelector<HTMLElement>(`[data-layout-path="${p}"]`);

export const mustPath = (p: string) => {
    const element = path(p);
    if (!element) throw new Error(`no element at ${p}`);
    return element;
};

export const byTestId = (id: string) =>
    document.querySelector<HTMLElement>(`[data-testid="${id}"]`);

export const mustTestId = (id: string) => {
    const element = byTestId(id);
    if (!element) throw new Error(`no element with test id ${id}`);
    return element;
};

export function keyDown(
    target: Element,
    init: KeyboardEventInit & { key: string },
) {
    target.dispatchEvent(
        new KeyboardEvent("keydown", {
            bubbles: true,
            cancelable: true,
            ...init,
        }),
    );
}

export function pointerDown(target: Element, init: MouseEventInit = {}) {
    const Pointer =
        typeof PointerEvent === "function" ? PointerEvent : MouseEvent;
    target.dispatchEvent(
        new Pointer("pointerdown", {
            bubbles: true,
            cancelable: true,
            button: 0,
            ...init,
        }),
    );
}

export function click(target: HTMLElement) {
    target.click();
}

export function typeInto(input: HTMLElement, value: string) {
    (input as HTMLInputElement).value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
}

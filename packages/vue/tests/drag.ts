import { DRAG_TYPE } from "@fragiola/dockable";
import { vi } from "vitest";

/** A fake DataTransfer: the types a drag carries (a Dockable drag carries DRAG_TYPE), and spies. */
export function fakeDataTransfer(types: string[] = [DRAG_TYPE]) {
    return {
        types,
        setData: vi.fn((type: string, _data: string) => {
            if (!types.includes(type)) types.push(type);
        }),
        getData: vi.fn(() => ""),
        setDragImage: vi.fn<(image: Element, x: number, y: number) => void>(),
        effectAllowed: "none",
        dropEffect: "none",
        files: [],
    };
}

/** jsdom has no DragEvent: a MouseEvent with a fake dataTransfer carries what the core reads. */
export function dragEvent(
    type: string,
    x = 50,
    y = 50,
    dataTransfer = fakeDataTransfer(),
) {
    const event = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
    });
    Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
    return event as unknown as DragEvent;
}

/** The element at a `data-layout-path`. */
export function path(p: string): HTMLElement {
    const element = document.querySelector<HTMLElement>(
        `[data-layout-path="${p}"]`,
    );
    if (!element) throw new Error(`no element at ${p}`);
    return element;
}

/** The element with a `data-testid`. */
export function byTestId(
    id: string,
    within: ParentNode = document,
): HTMLElement {
    const element = within.querySelector<HTMLElement>(`[data-testid="${id}"]`);
    if (!element) throw new Error(`no element with test id ${id}`);
    return element;
}

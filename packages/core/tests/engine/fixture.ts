import { type Mock, vi } from "vitest";
import {
    createModel,
    DRAG_TYPE,
    type LayoutEngine,
    type LayoutJson,
    type Model,
    type Rect,
} from "../../src";

/** Element rects for an injected `measure`: unknown elements measure as empty. */
export class Rects {
    private readonly map = new Map<Element, Rect>();

    set<E extends Element>(
        element: E,
        x: number,
        y: number,
        width: number,
        height: number,
    ): E {
        this.map.set(element, { x, y, width, height });
        return element;
    }

    measure = (element: Element): Rect =>
        this.map.get(element) ?? { x: 0, y: 0, width: 0, height: 0 };
}

/** A ResizeObserver stand-in that records what it watches. */
export class RecordingResizeObserver {
    static instances: RecordingResizeObserver[] = [];
    readonly observed = new Set<Element>();
    disconnected = false;
    readonly callback: () => void;

    constructor(callback: () => void) {
        this.callback = callback;
        RecordingResizeObserver.instances.push(this);
    }

    observe(element: Element) {
        this.observed.add(element);
    }

    unobserve(element: Element) {
        this.observed.delete(element);
    }

    disconnect() {
        this.disconnected = true;
        this.observed.clear();
    }
}

export const twoTabsets: LayoutJson = {
    version: 1,
    root: {
        type: "row",
        id: "row",
        children: [
            {
                type: "tabset",
                id: "ts0",
                weight: 50,
                children: [
                    { id: "t0", component: "test", data: { name: "One" } },
                    { id: "t1", component: "test", data: { name: "Two" } },
                ],
            },
            {
                type: "tabset",
                id: "ts1",
                weight: 50,
                children: [
                    { id: "t2", component: "test", data: { name: "Three" } },
                ],
            },
        ],
    },
};

/**
 * A root (400x300 at 10,20) holding a row with two tabsets side by side, each with a 30px strip
 * and a content area; the panels live in the root. Rects are in viewport coordinates.
 */
export function mountTwoTabsets(engine: LayoutEngine, rects: Rects) {
    const doc = document;
    const root = doc.createElement("div");
    doc.body.appendChild(root);
    rects.set(root, 10, 20, 400, 300);

    const el = () => root.appendChild(doc.createElement("div"));
    const row = rects.set(el(), 10, 20, 400, 300);
    const ts0 = rects.set(el(), 10, 20, 196, 300);
    const ts0strip = rects.set(el(), 10, 20, 196, 30);
    const ts0content = rects.set(el(), 10, 50, 196, 270);
    const ts1 = rects.set(el(), 214, 20, 196, 300);
    const ts1strip = rects.set(el(), 214, 20, 196, 30);
    const ts1content = rects.set(el(), 214, 50, 196, 270);
    const splitter = rects.set(el(), 206, 20, 8, 300);
    const panels = { t0: el(), t1: el(), t2: el() };

    engine.adapter.attachRoot(root);
    engine.adapter.prepare();
    engine.adapter.registerMeasurable("row", "row", row);
    engine.adapter.registerMeasurable("ts0", "tabset", ts0);
    engine.adapter.registerMeasurable("ts0", "tabstrip", ts0strip);
    engine.adapter.registerMeasurable("ts0", "tabsetcontent", ts0content);
    engine.adapter.registerMeasurable("ts1", "tabset", ts1);
    engine.adapter.registerMeasurable("ts1", "tabstrip", ts1strip);
    engine.adapter.registerMeasurable("ts1", "tabsetcontent", ts1content);
    engine.adapter.registerSplitter(splitter, () => true);
    for (const [id, panel] of Object.entries(panels)) {
        engine.adapter.registerTabPanel(id, panel);
    }
    return {
        root,
        row,
        ts0,
        ts0strip,
        ts0content,
        ts1,
        ts1strip,
        ts1content,
        splitter,
        panels,
    };
}

export function freshModel(json: LayoutJson = twoTabsets): Model {
    return createModel(structuredClone(json));
}

/** The commands a model ran, recorded by a middleware (engine-issued and direct alike). */
export function recordCommands(
    model: Model,
): { command: string; payload: unknown }[] {
    const commands: { command: string; payload: unknown }[] = [];
    model.use((ctx, next) => {
        if (!ctx.dryRun && !ctx.inBatch) {
            commands.push({ command: ctx.command, payload: ctx.payload });
        }
        return next();
    });
    return commands;
}

/** A fake DataTransfer: the types a drag carries, and spies for what the manager sets. */
export interface FakeDataTransfer {
    types: string[];
    setData: Mock<(type: string, data: string) => void>;
    getData: Mock<() => string>;
    setDragImage: Mock<(image: Element, x: number, y: number) => void>;
    effectAllowed: string;
    dropEffect: string;
    files: File[];
}

export function fakeDataTransfer(
    types: string[] = [DRAG_TYPE],
): FakeDataTransfer {
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

/**
 * jsdom has no DragEvent: a MouseEvent with a fake dataTransfer carries what the manager reads. A
 * Dockable drag carries `DRAG_TYPE`; pass other `types` for a foreign drag.
 */
export function dragEvent(
    type: string,
    x: number,
    y: number,
    dataTransfer: FakeDataTransfer = fakeDataTransfer(),
): DragEvent {
    const event = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
    });
    Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
    return event as unknown as DragEvent;
}

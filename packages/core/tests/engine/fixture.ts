import {
    type IJsonModel,
    type IRectLike,
    type LayoutEngine,
    Model,
    type RowNode,
    type TabNode,
    type TabSetNode,
} from "../../src";

/** Element rects for an injected `measure`: unknown elements measure as empty. */
export class Rects {
    private readonly map = new Map<Element, IRectLike>();

    set(element: Element, x: number, y: number, width: number, height: number) {
        this.map.set(element, { x, y, width, height });
        return element;
    }

    measure = (element: Element): IRectLike =>
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

export const twoTabsets: IJsonModel = {
    global: {},
    layout: {
        type: "row",
        id: "row",
        children: [
            {
                type: "tabset",
                id: "ts0",
                weight: 50,
                children: [
                    { type: "tab", id: "t0", name: "One" },
                    { type: "tab", id: "t1", name: "Two" },
                ],
            },
            {
                type: "tabset",
                id: "ts1",
                weight: 50,
                children: [{ type: "tab", id: "t2", name: "Three" }],
            },
        ],
    },
};

export function node<T>(model: Model, id: string): T {
    const found = model.getNodeById(id);
    if (!found) throw new Error(`no node ${id}`);
    return found as unknown as T;
}

/**
 * A root (400x300 at 10,20) holding a row with two tabsets side by side, each with a 30px strip
 * and a content area; the panels live in the root. Rects are in viewport coordinates.
 */
export function mountTwoTabsets(engine: LayoutEngine, rects: Rects) {
    const model = engine.getModel();
    const doc = document;
    const root = doc.createElement("div");
    doc.body.appendChild(root);
    rects.set(root, 10, 20, 400, 300);

    const el = () => root.appendChild(doc.createElement("div"));
    const row = rects.set(el(), 10, 20, 400, 300) as HTMLElement;
    const ts0 = rects.set(el(), 10, 20, 196, 300) as HTMLElement;
    const ts0content = rects.set(el(), 10, 50, 196, 270) as HTMLElement;
    const ts1 = rects.set(el(), 214, 20, 196, 300) as HTMLElement;
    const ts1content = rects.set(el(), 214, 50, 196, 270) as HTMLElement;
    const splitter = rects.set(el(), 206, 20, 8, 300) as HTMLElement;
    const panels = {
        t0: el(),
        t1: el(),
        t2: el(),
    };

    engine.attachRoot(root);
    engine.prepare();
    engine.registerMeasurable(node<RowNode>(model, "row"), "row", row);
    engine.registerMeasurable(node<TabSetNode>(model, "ts0"), "tabset", ts0);
    engine.registerMeasurable(
        node<TabSetNode>(model, "ts0"),
        "tabsetcontent",
        ts0content,
    );
    engine.registerMeasurable(node<TabSetNode>(model, "ts1"), "tabset", ts1);
    engine.registerMeasurable(
        node<TabSetNode>(model, "ts1"),
        "tabsetcontent",
        ts1content,
    );
    engine.registerSplitter(splitter, () => true);
    for (const [id, panel] of Object.entries(panels)) {
        engine.registerTabPanel(node<TabNode>(model, id), panel);
    }
    return { root, row, ts0, ts0content, ts1, ts1content, splitter, panels };
}

export function freshModel(json: IJsonModel = twoTabsets) {
    return Model.fromJson(structuredClone(json));
}

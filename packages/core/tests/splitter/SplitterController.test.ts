// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    type Action,
    Actions,
    type BorderNode,
    createLayoutEngine,
    createSplitterController,
    DockLocation,
    type LayoutEngine,
    Model,
    Rect,
    type RowNode,
    type SplitterController,
    type TabSetNode,
} from "../../src";
import { freshModel, mountTwoTabsets, node, Rects } from "../engine/fixture";

let engine: LayoutEngine | undefined;
let controller: SplitterController | undefined;

afterEach(() => {
    controller?.dispose();
    controller = undefined;
    engine?.dispose();
    engine = undefined;
    document.body.innerHTML = "";
    vi.useRealTimers();
});

function setup(realtimeResize = true) {
    const model = freshModel();
    const rects = new Rects();
    const actions: Action[] = [];
    engine = createLayoutEngine({
        model,
        measure: rects.measure,
        realtimeResize,
        onAction: (action) => {
            actions.push(action);
            return action;
        },
    });
    const dom = mountTwoTabsets(engine, rects);
    engine.sync();
    controller = createSplitterController(
        engine,
        node<RowNode>(model, "row"),
        1,
    );
    controller.attach(dom.splitter);
    return { model, rects, actions, engine, controller, ...dom };
}

function pointer(
    type: string,
    target: EventTarget,
    clientX: number,
    clientY = 100,
) {
    const event = new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX,
        clientY,
        pointerId: 1,
    });
    target.dispatchEvent(event);
    return event;
}

/** pointerdown on the splitter (viewport x 210 = 4px into the splitter at 206) */
function pointerDown(
    splitter: HTMLElement,
    c: SplitterController,
    clientX = 210,
) {
    const event = new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        clientX,
        clientY: 100,
        pointerId: 1,
    });
    splitter.addEventListener("pointerdown", c.onPointerDown, { once: true });
    splitter.dispatchEvent(event);
}

function key(
    c: SplitterController,
    keyName: string,
    mods: Partial<KeyboardEventInit> = {},
) {
    const event = new KeyboardEvent("keydown", {
        key: keyName,
        cancelable: true,
        ...mods,
    });
    c.onKeyDown(event);
    return event;
}

describe("SplitterController pointer drag", () => {
    it("realtime: streams adjusting weight actions, then commits once on release", () => {
        const { actions, splitter, controller } = setup(true);
        pointerDown(splitter, controller);
        expect(controller.getState()).toEqual({
            dragging: true,
            previewOffset: undefined,
        });

        pointer("pointermove", document, 230);
        pointer("pointermove", document, 250);
        const adjusting = actions.filter((a) => a.isAdjusting());
        expect(adjusting.length).toBe(2);
        expect(adjusting.every((a) => a.type === Actions.ADJUST_WEIGHTS)).toBe(
            true,
        );

        pointer("pointerup", document, 250);
        const final = actions.at(-1);
        expect(final?.type).toBe(Actions.ADJUST_WEIGHTS);
        expect(final?.isAdjusting()).toBe(false);
        expect(actions.filter((a) => !a.isAdjusting())).toHaveLength(1);
        expect(controller.getState().dragging).toBe(false);
    });

    it("outline: previews without touching the model, then commits a single action", () => {
        const { model, actions, splitter, controller } = setup(false);
        const before = node<TabSetNode>(model, "ts0").getWeight();
        pointerDown(splitter, controller);
        expect(controller.getState()).toEqual({
            dragging: true,
            previewOffset: 0,
        });

        pointer("pointermove", document, 240);
        expect(controller.getState().previewOffset).toBe(30);
        expect(actions).toHaveLength(0);
        expect(node<TabSetNode>(model, "ts0").getWeight()).toBe(before);

        pointer("pointerup", document, 240);
        expect(actions).toHaveLength(1);
        expect(actions[0]?.isAdjusting()).toBe(false);
        const weights = actions[0]?.data.weights as number[];
        // the tabset before the splitter grows by the 30px preview offset
        expect(weights[0]).toBeCloseTo((226 * 100) / 392, 3);
        expect(controller.getState()).toEqual({
            dragging: false,
            previewOffset: undefined,
        });
    });

    it("clamps the position to the splitter bounds", () => {
        const { model, splitter, controller } = setup(false);
        const bounds = node<RowNode>(model, "row").getSplitterBounds(1);
        pointerDown(splitter, controller);

        pointer("pointermove", document, 5000);
        expect(controller.getState().previewOffset).toBe(bounds[1] - 196);

        pointer("pointermove", document, -5000);
        expect(controller.getState().previewOffset).toBe(bounds[0] - 196);
    });

    it("cancel: realtime commits the in-progress resize, outline leaves the model untouched", () => {
        const realtime = setup(true);
        pointerDown(realtime.splitter, realtime.controller);
        pointer("pointermove", document, 230);
        pointer("pointercancel", document, 230);
        expect(realtime.actions.at(-1)?.isAdjusting()).toBe(false);
        realtime.controller.dispose();
        realtime.engine.dispose();
        document.body.innerHTML = "";

        const outline = setup(false);
        pointerDown(outline.splitter, outline.controller);
        pointer("pointermove", document, 230);
        pointer("pointercancel", document, 230);
        expect(outline.actions).toHaveLength(0);
        expect(outline.controller.getState().dragging).toBe(false);
    });

    it("holds the engine's splitter-dragging flag until after release", () => {
        vi.useFakeTimers();
        const { engine, splitter, controller } = setup(true);
        pointerDown(splitter, controller);
        expect(engine.isSplitterDragging()).toBe(true);
        pointer("pointerup", document, 210);
        expect(engine.isSplitterDragging()).toBe(true);
        vi.advanceTimersByTime(300);
        expect(engine.isSplitterDragging()).toBe(false);
    });

    it("disables pointer events on iframes during the drag", () => {
        const { root, splitter, controller } = setup(true);
        const iframe = root.appendChild(document.createElement("iframe"));
        pointerDown(splitter, controller);
        expect(iframe.style.pointerEvents).toBe("none");
        pointer("pointerup", document, 210);
        expect(iframe.style.pointerEvents).toBe("auto");
    });

    it("notifies subscribers only when the state changes", () => {
        const { splitter, controller } = setup(false);
        const listener = vi.fn();
        controller.subscribe(listener);
        pointerDown(splitter, controller);
        pointer("pointermove", document, 240);
        pointer("pointermove", document, 240);
        expect(listener).toHaveBeenCalledTimes(2);
        const state = controller.getState();
        expect(controller.getState()).toBe(state);
    });

    it("dispose mid-drag stops listening without committing", () => {
        const { actions, engine, splitter, controller } = setup(true);
        pointerDown(splitter, controller);
        controller.dispose();
        expect(engine.isSplitterDragging()).toBe(false);
        expect(controller.getState().dragging).toBe(false);

        pointer("pointermove", document, 260);
        pointer("pointerup", document, 260);
        expect(actions).toHaveLength(0);
    });
});

describe("SplitterController pointer guards", () => {
    it("drags with the primary button only", () => {
        const { actions, splitter, controller } = setup(true);
        splitter.addEventListener("pointerdown", controller.onPointerDown, {
            once: true,
        });
        splitter.dispatchEvent(
            new PointerEvent("pointerdown", {
                bubbles: true,
                clientX: 210,
                clientY: 100,
                pointerId: 1,
                button: 2,
            }),
        );
        expect(controller.getState().dragging).toBe(false);
        pointer("pointermove", document, 260);
        pointer("pointerup", document, 260);
        expect(actions).toHaveLength(0);
    });

    it("commits nothing for a press without movement", () => {
        const { actions, splitter, controller } = setup(true);
        pointerDown(splitter, controller);
        pointer("pointerup", document, 210);
        expect(actions).toHaveLength(0);
        expect(controller.getState().dragging).toBe(false);
    });

    it("follows only the pointer that started the drag", () => {
        const { actions, splitter, controller } = setup(false);
        pointerDown(splitter, controller);
        document.dispatchEvent(
            new PointerEvent("pointermove", {
                bubbles: true,
                clientX: 300,
                clientY: 100,
                pointerId: 2,
            }),
        );
        expect(controller.getState().previewOffset).toBe(0);
        document.dispatchEvent(
            new PointerEvent("pointerup", {
                bubbles: true,
                clientX: 300,
                clientY: 100,
                pointerId: 2,
            }),
        );
        expect(controller.getState().dragging).toBe(true);
        pointer("pointermove", document, 240);
        pointer("pointerup", document, 240);
        expect(actions).toHaveLength(1);
    });

    it("dispose mid realtime drag commits the resize it already applied", () => {
        const { actions, splitter, controller } = setup(true);
        pointerDown(splitter, controller);
        pointer("pointermove", document, 240);
        controller.dispose();
        expect(actions.at(-1)?.isAdjusting()).toBe(false);
    });

    it("measures the splitter along its current orientation", () => {
        const { model, rects, engine, splitter } = setup(true);
        engine.sync();
        expect(model.getSplitterSize()).toBe(8);
        // the row turns vertical: the same splitter is now a horizontal bar, 8px high
        rects.set(splitter, 10, 180, 400, 8);
        model.doAction(
            Actions.updateModelAttributes({ rootOrientationVertical: true }),
        );
        engine.sync();
        expect(model.getSplitterSize()).toBe(8);
    });
});

describe("SplitterController keyboard", () => {
    it("moves by 10px with the arrow keys of its axis", () => {
        const { actions, controller } = setup();
        const event = key(controller, "ArrowRight");
        expect(event.defaultPrevented).toBe(true);
        expect(actions).toHaveLength(1);
        const weights = actions[0]?.data.weights as number[];
        expect(weights[0]).toBeCloseTo((206 * 100) / 392, 3);

        key(controller, "ArrowLeft");
        expect(actions).toHaveLength(2);

        key(controller, "ArrowUp"); // not this splitter's axis
        expect(actions).toHaveLength(2);
    });

    it("leaves modified arrows to keymap bindings", () => {
        const { actions, controller } = setup();
        const event = key(controller, "ArrowRight", { ctrlKey: true });
        expect(event.defaultPrevented).toBe(false);
        expect(actions).toHaveLength(0);
    });

    it("skips an unmeasured (zero-sum) row", () => {
        const model = freshModel();
        const actions: Action[] = [];
        engine = createLayoutEngine({
            model,
            onAction: (a) => {
                actions.push(a);
                return a;
            },
        });
        controller = createSplitterController(
            engine,
            node<RowNode>(model, "row"),
            1,
        );
        key(controller, "ArrowRight");
        expect(actions).toHaveLength(0);
    });
});

describe("SplitterController ARIA", () => {
    it("reports a row splitter as a 0-100 percentage", () => {
        const { controller } = setup();
        expect(controller.getAria()).toEqual({
            orientation: "vertical",
            valueNow: 49,
            valueMin: 0,
            valueMax: 100,
            valueText: "49%",
        });
    });

    it("reports a border splitter in px with min and max", () => {
        const model = Model.fromJson({
            global: {},
            borders: [
                {
                    type: "border",
                    location: "left",
                    size: 200,
                    minSize: 50,
                    maxSize: 400,
                    children: [{ type: "tab", name: "B" }],
                },
            ],
            layout: {
                type: "row",
                children: [
                    { type: "tabset", children: [{ type: "tab", name: "A" }] },
                ],
            },
        });
        engine = createLayoutEngine({ model });
        const border = model
            .getBorderSet()
            .getBorderMap()
            .get(DockLocation.LEFT) as BorderNode;
        controller = createSplitterController(engine, border, 0);
        expect(controller.getAria()).toEqual({
            orientation: "vertical",
            valueNow: 200,
            valueMin: 50,
            valueMax: 400,
            valueText: "200px",
        });
    });

    it("is hidden while a tabset is maximized", () => {
        const { model, controller } = setup();
        expect(controller.isHidden()).toBe(false);
        model.doAction(Actions.maximizeToggle("ts0"));
        expect(controller.isHidden()).toBe(true);
    });

    it("registers its element for splitter-size discovery", () => {
        const { engine, splitter } = setup();
        expect(engine.getRegistrations().splitters.get(splitter)?.()).toBe(
            true,
        );
        controller?.attach(null);
        expect(engine.getRegistrations().splitters.has(splitter)).toBe(false);
    });
});

describe("Rect sanity for the fixture", () => {
    it("the row is measured before splitting", () => {
        const { model } = setup();
        expect(node<RowNode>(model, "row").getRect()).toEqual(
            new Rect(0, 0, 400, 300),
        );
    });
});

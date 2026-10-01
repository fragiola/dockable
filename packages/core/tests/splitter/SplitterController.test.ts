// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    type CommandEvent,
    createLayoutEngine,
    createModel,
    createSplitterController,
    type LayoutEngine,
    type SplitterController,
} from "../../src";
import { splitterBounds } from "../../src/split/split";
import { freshModel, mountTwoTabsets, Rects } from "../engine/fixture";

let engine: LayoutEngine | undefined;
let controller: SplitterController | undefined;

afterEach(() => {
    controller?.dispose();
    controller = undefined;
    engine?.adapter.dispose();
    engine = undefined;
    document.body.innerHTML = "";
    vi.useRealTimers();
});

/** a commit as the tests read it */
interface Committed {
    command: string;
    weights: number[];
    transient: boolean;
}

function record(model: ReturnType<typeof freshModel>): Committed[] {
    const actions: Committed[] = [];
    model.subscribe((event: CommandEvent) => {
        actions.push({
            command: event.command,
            weights: (event.payload as { weights?: number[] }).weights ?? [],
            transient: event.transient,
        });
    });
    return actions;
}

function setup(realtimeResize = true) {
    const model = freshModel();
    const rects = new Rects();
    const actions = record(model);
    engine = createLayoutEngine({
        model,
        measure: rects.measure,
        realtimeResize,
    });
    const dom = mountTwoTabsets(engine, rects);
    engine.run("measure-and-position");
    controller = createSplitterController(engine, "row", 1);
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
    it("realtime: streams transient row.resize commands, then commits one on release", () => {
        const { actions, splitter, controller } = setup(true);
        pointerDown(splitter, controller);
        expect(controller.getState()).toEqual({
            dragging: true,
            previewOffset: undefined,
        });

        pointer("pointermove", document, 230);
        pointer("pointermove", document, 250);
        const transient = actions.filter((a) => a.transient);
        expect(transient.length).toBe(2);
        expect(transient.every((a) => a.command === "row.resize")).toBe(true);

        pointer("pointerup", document, 250);
        const final = actions.at(-1);
        expect(final?.command).toBe("row.resize");
        expect(final?.transient).toBe(false);
        expect(actions.filter((a) => !a.transient)).toHaveLength(1);
        expect(controller.getState().dragging).toBe(false);
    });

    it("outline: previews without touching the model, then commits a single command", () => {
        const { model, actions, splitter, controller } = setup(false);
        const before = model.state;
        pointerDown(splitter, controller);
        expect(controller.getState()).toEqual({
            dragging: true,
            previewOffset: 0,
        });

        pointer("pointermove", document, 240);
        expect(controller.getState().previewOffset).toBe(30);
        expect(actions).toHaveLength(0);
        expect(model.state).toBe(before);

        pointer("pointerup", document, 240);
        expect(actions).toHaveLength(1);
        expect(actions[0]?.transient).toBe(false);
        const weights = actions[0]?.weights ?? [];
        // the tabset before the splitter grows by the 30px preview offset
        expect(weights[0]).toBeCloseTo((226 * 100) / 392, 3);
        expect(controller.getState()).toEqual({
            dragging: false,
            previewOffset: undefined,
        });
    });

    it("clamps the position to the splitter bounds", () => {
        const { engine, splitter, controller } = setup(false);
        const children = ["ts0", "ts1"].map((id) => ({
            rect: engine.adapter.rect("tabset", id) ?? {
                x: 0,
                y: 0,
                width: 0,
                height: 0,
            },
            range: engine.get("size-limits", { node: id }),
        }));
        const bounds = splitterBounds(
            children,
            "horizontal",
            engine.get("splitter-size"),
            1,
        );
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
        expect(realtime.actions.at(-1)?.transient).toBe(false);
        realtime.controller.dispose();
        realtime.engine.adapter.dispose();
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
        expect(engine.is("splitter-dragging")).toBe(true);
        pointer("pointerup", document, 210);
        expect(engine.is("splitter-dragging")).toBe(true);
        vi.advanceTimersByTime(300);
        expect(engine.is("splitter-dragging")).toBe(false);
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
        expect(engine.is("splitter-dragging")).toBe(false);
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
        expect(actions.at(-1)?.transient).toBe(false);
    });

    it("measures the splitter along its current orientation", () => {
        const { model, rects, engine, splitter } = setup(true);
        engine.run("measure-and-position");
        expect(engine.get("splitter-size")).toBe(8);
        // the row turns vertical: the same splitter is now a horizontal bar, 8px high
        rects.set(splitter, 10, 180, 400, 8);
        model.run("layout.configure", {
            defaults: { layout: { rootOrientation: "vertical" } },
        });
        engine.run("measure-and-position");
        expect(engine.get("splitter-size")).toBe(8);
    });
});

describe("SplitterController keyboard", () => {
    it("moves by 10px with the arrow keys of its axis", () => {
        const { actions, controller } = setup();
        const event = key(controller, "ArrowRight");
        expect(event.defaultPrevented).toBe(true);
        expect(actions).toHaveLength(1);
        const weights = actions[0]?.weights ?? [];
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
        const actions = record(model);
        engine = createLayoutEngine({ model });
        controller = createSplitterController(engine, "row", 1);
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
        const model = createModel({
            version: 1,
            borders: [
                {
                    location: "left",
                    size: 200,
                    minSize: 50,
                    maxSize: 400,
                    children: [{ component: "x" }],
                },
            ],
            root: {
                type: "row",
                children: [{ type: "tabset", children: [{ component: "x" }] }],
            },
        });
        engine = createLayoutEngine({ model });
        controller = createSplitterController(engine, "border_left", 0);
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
        model.run("tabset.maximize", { tabsetId: "ts0", value: true });
        expect(controller.isHidden()).toBe(true);
    });

    it("registers its element for splitter-size discovery", () => {
        const { engine, splitter } = setup();
        expect(
            engine.adapter.getRegistrations().splitters.get(splitter)?.(),
        ).toBe(true);
        controller?.attach(null);
        expect(engine.adapter.getRegistrations().splitters.has(splitter)).toBe(
            false,
        );
    });
});

describe("border splitters", () => {
    it("resize the border with border.resize, transient while dragged, clamped to its limits", () => {
        const model = createModel({
            version: 1,
            borders: [
                {
                    location: "left",
                    size: 200,
                    minSize: 50,
                    maxSize: 300,
                    selected: 0,
                    children: [{ component: "x" }],
                },
            ],
            root: {
                type: "row",
                id: "row",
                children: [{ type: "tabset", children: [{ component: "x" }] }],
            },
        });
        const actions: {
            command: string;
            payload: unknown;
            transient: boolean;
        }[] = [];
        model.subscribe((event) => actions.push(event));
        const rects = new Rects();
        engine = createLayoutEngine({ model, measure: rects.measure });
        const root = rects.set(
            document.body.appendChild(document.createElement("div")),
            0,
            0,
            800,
            600,
        );
        const el = () => root.appendChild(document.createElement("div"));
        engine.adapter.attachRoot(root);
        engine.adapter.registerMeasurable(
            "border_left",
            "borderheader",
            rects.set(el(), 0, 0, 30, 600),
        );
        engine.adapter.registerMeasurable(
            "row",
            "row",
            rects.set(el(), 238, 0, 562, 600),
        );
        const splitterElement = rects.set(el(), 230, 0, 8, 600);
        engine.run("measure-and-position");
        controller = createSplitterController(engine, "border_left", 0);
        controller.attach(splitterElement);
        expect(controller.isHorizontal()).toBe(true);

        pointerDown(splitterElement, controller, 232);
        pointer("pointermove", document, 282); // 50px wider
        expect(actions.at(-1)).toMatchObject({
            command: "border.resize",
            payload: { borderId: "border_left", size: 250 },
            transient: true,
        });
        pointer("pointermove", document, 900); // clamped by the bounds to the maximum
        pointer("pointerup", document, 900);
        expect(actions.at(-1)).toMatchObject({
            command: "border.resize",
            transient: false,
        });
        expect(model.get("node", { node: "border_left" })).toMatchObject({
            size: 300,
        });

        key(controller, "ArrowLeft"); // towards the border's edge: it shrinks
        expect(model.get("node", { node: "border_left" })).toMatchObject({
            size: 290,
        });
    });
});

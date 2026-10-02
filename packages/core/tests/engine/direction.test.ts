// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
    createLayoutEngine,
    createSplitterController,
    DragDropManager,
    type LayoutEngine,
    type LayoutJson,
    type Rect,
    type SplitterController,
} from "../../src";
import {
    dragEvent,
    freshModel,
    Rects,
    recordCommands,
    twoTabsets,
} from "./fixture";

const engines: LayoutEngine[] = [];
const controllers: SplitterController[] = [];
afterEach(() => {
    if (DragDropManager.getDragState()) {
        DragDropManager.endDrag();
    }
    for (const controller of controllers.splice(0)) controller.dispose();
    for (const engine of engines.splice(0)) engine.adapter.dispose();
    document.body.innerHTML = "";
});

const DIRECTIONS = ["ltr"] as const;
type Direction = (typeof DIRECTIONS)[number];

/**
 * Every rect and point of these tests is written for LTR; in RTL the page renders it mirrored in
 * the root, so `x` maps a viewport x, `rect` a viewport rect and `local` a rect relative to the root.
 */
function mirror(direction: Direction, rootX: number, rootWidth: number) {
    const rtl = (direction as string) === "rtl";
    return {
        x: (x: number) => (rtl ? 2 * rootX + rootWidth - x : x),
        rect: (x: number, width: number) =>
            rtl ? 2 * rootX + rootWidth - x - width : x,
        local: (x: number, y: number, width: number, height: number): Rect => ({
            x: rtl ? rootWidth - x - width : x,
            y,
            width,
            height,
        }),
    };
}

/**
 * The two-tabset layout (root 400x300 at 10,20): ts0 holds t0 and t1 (50px buttons from the start
 * of its strip), ts1 holds t2, an 8px splitter between them.
 */
function setup(
    direction: Direction,
    json: LayoutJson = twoTabsets,
    realtimeResize = true,
) {
    const model = freshModel(json);
    const rects = new Rects();
    const commands = recordCommands(model);
    const engine = createLayoutEngine({
        model,
        measure: rects.measure,
        realtimeResize,
    });
    engines.push(engine);
    const m = mirror(direction, 10, 400);
    const root = document.body.appendChild(document.createElement("div"));
    root.setAttribute("dir", direction);
    rects.set(root, 10, 20, 400, 300);
    const el = (x: number, y: number, width: number, height: number) =>
        rects.set(
            root.appendChild(document.createElement("div")),
            m.rect(x, width),
            y,
            width,
            height,
        );
    const at = {
        row: el(10, 20, 400, 300),
        ts0: el(10, 20, 196, 300),
        ts0strip: el(10, 20, 196, 30),
        ts0content: el(10, 50, 196, 270),
        t0: el(10, 20, 50, 30),
        t1: el(60, 20, 50, 30),
        splitter: el(206, 20, 8, 300),
        ts1: el(214, 20, 196, 300),
        ts1strip: el(214, 20, 196, 30),
        ts1content: el(214, 50, 196, 270),
        t2: el(214, 20, 50, 30),
    };
    const a = engine.adapter;
    a.attachRoot(root);
    a.prepare();
    a.registerMeasurable("row", "row", at.row);
    a.registerMeasurable("ts0", "tabset", at.ts0);
    a.registerMeasurable("ts0", "tabstrip", at.ts0strip);
    a.registerMeasurable("ts0", "tabsetcontent", at.ts0content);
    a.registerMeasurable("t0", "tabbutton", at.t0);
    a.registerMeasurable("t1", "tabbutton", at.t1);
    a.registerMeasurable("ts1", "tabset", at.ts1);
    a.registerMeasurable("ts1", "tabstrip", at.ts1strip);
    a.registerMeasurable("ts1", "tabsetcontent", at.ts1content);
    a.registerMeasurable("t2", "tabbutton", at.t2);
    engine.run("measure-and-position");
    const controller = createSplitterController(engine, "row", 1);
    controllers.push(controller);
    controller.attach(at.splitter);
    return { model, rects, commands, engine, controller, root, m, ...at };
}

function pointer(type: string, target: EventTarget, clientX: number) {
    target.dispatchEvent(
        new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            clientX,
            clientY: 100,
            pointerId: 1,
        }),
    );
}

function drag(
    target: HTMLElement,
    controller: SplitterController,
    from: number,
    to: number,
) {
    target.addEventListener("pointerdown", controller.onPointerDown, {
        once: true,
    });
    pointer("pointerdown", target, from);
    pointer("pointermove", target.ownerDocument, to);
}

function key(controller: SplitterController, name: string) {
    controller.onKeyDown(
        new KeyboardEvent("keydown", { key: name, cancelable: true }),
    );
}

/** the arrow key that moves a splitter towards the end side, on screen */
const towardsEnd = (direction: Direction) =>
    (direction as string) === "rtl" ? "ArrowLeft" : "ArrowRight";
const towardsStart = (direction: Direction) =>
    (direction as string) === "rtl" ? "ArrowRight" : "ArrowLeft";

function lastWeights(commands: { command: string; payload: unknown }[]) {
    const last = commands
        .filter(({ command }) => command === "row.resize")
        .at(-1);
    return (last?.payload as { weights: number[] } | undefined)?.weights ?? [];
}

describe.each(DIRECTIONS)("a row splitter in %s", (direction) => {
    it("follows the pointer: dragged 50px towards the end, the start child grows by 50px", () => {
        const s = setup(direction);
        drag(s.splitter, s.controller, s.m.x(210), s.m.x(260));
        pointer("pointerup", document, s.m.x(260));
        expect(lastWeights(s.commands)[0]).toBeCloseTo((246 * 100) / 392, 3);
    });

    it("previews an outline drag on screen, where the pointer is", () => {
        const s = setup(direction, twoTabsets, false);
        drag(s.splitter, s.controller, s.m.x(210), s.m.x(260));
        expect(s.controller.getState().previewOffset).toBe(
            s.m.x(260) - s.m.x(210),
        );
        pointer("pointerup", document, s.m.x(260));
        expect(lastWeights(s.commands)[0]).toBeCloseTo((246 * 100) / 392, 3);
    });

    it("stops at the end child's minimum, never jumping to the whole row", () => {
        const s = setup(direction);
        drag(s.splitter, s.controller, s.m.x(210), s.m.x(2000));
        const weights = lastWeights(s.commands);
        drag(s.splitter, s.controller, s.m.x(210), s.m.x(-2000));
        const back = lastWeights(s.commands);
        expect(weights[0]).toBeGreaterThan(80);
        expect(weights[0]).toBeLessThan(100);
        expect(back[0]).toBeLessThan(20);
        expect(back[0]).toBeGreaterThan(0);
    });

    it("moves 10px towards the arrow key's side of the screen", () => {
        const s = setup(direction);
        key(s.controller, towardsEnd(direction));
        expect(lastWeights(s.commands)[0]).toBeCloseTo((206 * 100) / 392, 3);
        key(s.controller, towardsStart(direction));
        expect(lastWeights(s.commands)[0]).toBeCloseTo((186 * 100) / 392, 3);
    });

    it("announces the start child's share of the row", () => {
        const s = setup(direction);
        expect(s.controller.getAria().valueNow).toBe(49);
        s.rects.set(s.ts0, s.m.rect(10, 206), 20, 206, 300);
        s.rects.set(s.splitter, s.m.rect(216, 8), 20, 8, 300);
        s.rects.set(s.ts1, s.m.rect(224, 186), 20, 186, 300);
        s.engine.run("measure-and-position");
        expect(s.controller.getAria().valueNow).toBe(51.5);
    });
});

/** a 800x600 root at 0,0 with one border on `location` (a 30px strip) and the layout beside it */
function borderSetup(direction: Direction, location: "start" | "end") {
    const model = freshModel({
        version: 1,
        borders: [
            {
                location,
                size: 200,
                minSize: 50,
                maxSize: 300,
                selected: 0,
                children: [{ component: "x", label: "x" }],
            },
        ],
        root: {
            type: "row",
            id: "row",
            children: [
                {
                    type: "tabset",
                    children: [{ component: "x", label: "x" }],
                },
            ],
        },
    });
    const commands = recordCommands(model);
    const rects = new Rects();
    const engine = createLayoutEngine({ model, measure: rects.measure });
    engines.push(engine);
    const m = mirror(direction, 0, 800);
    const root = document.body.appendChild(document.createElement("div"));
    root.setAttribute("dir", direction);
    rects.set(root, 0, 0, 800, 600);
    const el = (x: number, width: number) =>
        rects.set(
            root.appendChild(document.createElement("div")),
            m.rect(x, width),
            0,
            width,
            600,
        );
    const start = location === "start";
    engine.adapter.attachRoot(root);
    const strip = el(start ? 0 : 770, 30);
    engine.adapter.registerMeasurable(
        `border_${location}`,
        "borderheader",
        strip,
    );
    engine.adapter.registerMeasurable("row", "row", el(start ? 238 : 0, 562));
    const splitter = el(start ? 230 : 562, 8);
    engine.run("measure-and-position");
    const controller = createSplitterController(
        engine,
        `border_${location}`,
        0,
    );
    controllers.push(controller);
    controller.attach(splitter);
    const sizes = () =>
        commands
            .filter(({ command }) => command === "border.resize")
            .map(({ payload }) => (payload as { size: number }).size);
    return { controller, splitter, m, sizes };
}

describe.each(DIRECTIONS)("a border splitter in %s", (direction) => {
    it("grows a start border dragged towards the layout, and with the key towards it", () => {
        const s = borderSetup(direction, "start");
        drag(s.splitter, s.controller, s.m.x(232), s.m.x(282));
        pointer("pointerup", document, s.m.x(282));
        expect(s.sizes().at(-1)).toBe(250);
        key(s.controller, towardsEnd(direction));
        expect(s.sizes().at(-1)).toBe(260);
    });

    it("grows an end border dragged towards the layout, and with the key towards it", () => {
        const s = borderSetup(direction, "end");
        drag(s.splitter, s.controller, s.m.x(566), s.m.x(516));
        pointer("pointerup", document, s.m.x(516));
        expect(s.sizes().at(-1)).toBe(250);
        key(s.controller, towardsStart(direction));
        expect(s.sizes().at(-1)).toBe(260);
    });
});

describe.each(DIRECTIONS)("drops in %s", (direction) => {
    /** the indicator while tab `tabId` is dragged over the LTR point (x, y) */
    function over(
        s: ReturnType<typeof setup>,
        tabId: string,
        x: number,
        y: number,
    ) {
        const manager = s.engine.adapter.getDragDropManager();
        manager.startDrag(dragEvent("dragstart", 0, 0), tabId);
        s.root.dispatchEvent(dragEvent("dragenter", s.m.x(x), y));
        s.root.dispatchEvent(dragEvent("dragover", s.m.x(x), y));
        const indicator = manager.getIndicatorState();
        DragDropManager.endDrag();
        return indicator;
    }

    it("dock beside a tabset on the side the pointer is near", () => {
        const s = setup(direction);
        expect(over(s, "t0", 400, 185)).toMatchObject({
            targetNodeId: "ts1",
            location: "end",
            rect: s.m.local(302, 0, 98, 300),
        });
        expect(over(s, "t0", 220, 185)).toMatchObject({
            targetNodeId: "ts1",
            location: "start",
            rect: s.m.local(204, 0, 98, 300),
        });
    });

    it("dock to the layout's edge the pointer is near", () => {
        const s = setup(direction);
        expect(over(s, "t0", 12, 170)).toMatchObject({
            kind: "edge",
            location: "start",
            rect: s.m.local(0, 0, 100, 300),
        });
        expect(over(s, "t0", 405, 170)).toMatchObject({
            kind: "edge",
            location: "end",
            rect: s.m.local(300, 0, 100, 300),
        });
        const bands = Object.fromEntries(
            s.engine.adapter
                .edgeBands()
                .map(({ location, rect }) => [location, rect]),
        );
        expect(bands.start).toEqual(s.m.local(0, 100, 10, 100));
        expect(bands.end).toEqual(s.m.local(390, 100, 10, 100));
        expect(bands.top).toEqual(s.m.local(150, 0, 100, 10));
    });

    it("go into a strip at the start, between tabs and at the end, in reading order", () => {
        const s = setup(direction);
        expect(over(s, "t2", 20, 35)).toMatchObject({
            targetNodeId: "ts0",
            index: 0,
            rect: s.m.local(-2, 0, 3, 30),
        });
        expect(over(s, "t2", 70, 35)).toMatchObject({
            index: 1,
            rect: s.m.local(48, 0, 3, 30),
        });
        expect(over(s, "t2", 100, 35)).toMatchObject({
            index: 2,
            rect: s.m.local(98, 0, 3, 30),
        });
    });

    it("reveal the empty auto-hide border on the side the pointer is near", () => {
        const s = setup(direction, {
            ...structuredClone(twoTabsets),
            borders: [
                { location: "start", autoHide: true, children: [] },
                { location: "end", autoHide: true, children: [] },
            ],
        });
        expect(over(s, "t0", 12, 40).revealedBorder).toBe("start");
        expect(over(s, "t0", 408, 40).revealedBorder).toBe("end");
    });
});

describe.each(DIRECTIONS)("overlay borders in %s", (direction) => {
    it("sit on their side of the screen", () => {
        const s = setup(direction, {
            ...structuredClone(twoTabsets),
            borders: (["start", "end"] as const).map((location) => ({
                location,
                mode: "overlay" as const,
                selected: 0,
                children: [{ component: "test", label: location }],
            })),
        });
        const rtl = (direction as string) === "rtl";
        expect(
            s.engine.get("overlay-placement-by", { borderId: "border_start" }),
        ).toEqual({ [rtl ? "right" : "left"]: 0, top: 0, bottom: 0 });
        expect(
            s.engine.get("overlay-placement-by", { borderId: "border_end" }),
        ).toEqual({ [rtl ? "left" : "right"]: 0, top: 0, bottom: 0 });
    });
});

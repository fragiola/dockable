// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    createLayoutEngine,
    createSplitterController,
    type LayoutEngine,
    type LayoutJson,
} from "../../src";
import { computePaths } from "../../src/paths";
import { sizeRanges } from "../../src/split/split";
import {
    freshModel,
    mountTwoTabsets,
    RecordingResizeObserver,
    Rects,
    twoTabsets,
} from "./fixture";

vi.mock(import("../../src/paths"), async (original) => {
    const module = await original();
    return { ...module, computePaths: vi.fn(module.computePaths) };
});
vi.mock(import("../../src/split/split"), async (original) => {
    const module = await original();
    return { ...module, sizeRanges: vi.fn(module.sizeRanges) };
});

let engine: LayoutEngine | undefined;

beforeEach(() => {
    RecordingResizeObserver.instances = [];
    vi.stubGlobal("ResizeObserver", RecordingResizeObserver);
});

afterEach(() => {
    engine?.adapter.dispose();
    engine = undefined;
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
});

function setup(json: LayoutJson = twoTabsets) {
    const model = freshModel(json);
    const rects = new Rects();
    engine = createLayoutEngine({ model, measure: rects.measure });
    const dom = mountTwoTabsets(engine, rects);
    engine.run("measure-and-position");
    engine.adapter.prepare();
    read(engine);
    vi.mocked(computePaths).mockClear();
    vi.mocked(sizeRanges).mockClear();
    return { model, rects, engine, ...dom };
}

function read(engine: LayoutEngine) {
    return {
        path: engine.get("layout-path-by", { nodeId: "t2" }),
        minHeight: engine.get("size-limits-by", { nodeId: "ts0" }).minHeight,
    };
}

describe("LayoutEngine derived view data", () => {
    it("computes no size range for a row's orientation (a splitter drag reads it)", () => {
        const { model, engine } = setup();
        model.run(
            "row.resize",
            { rowId: "row", weights: [30, 70] },
            { transient: true },
        );
        expect(engine.adapter.rowOrientation("row")).toBe("horizontal");
        expect(sizeRanges).not.toHaveBeenCalled();
    });

    it("does no work on a read when nothing changed", () => {
        const { engine } = setup();
        for (let i = 0; i < 5; i++) {
            engine.adapter.prepare();
            expect(read(engine)).toEqual({ path: "/ts1/t0", minHeight: 31 });
        }
        expect(computePaths).not.toHaveBeenCalled();
        expect(sizeRanges).not.toHaveBeenCalled();
    });

    it("recomputes the paths and the ranges once per state", () => {
        const { model, engine } = setup();
        model.run("tab.move", { tabId: "t2", to: "ts0" });
        expect(read(engine).path).toBe("/ts0/t2");
        read(engine);
        expect(computePaths).toHaveBeenCalledTimes(1);
        expect(sizeRanges).toHaveBeenCalledTimes(1);
    });

    it("recomputes only the ranges when a tab strip's height changes", () => {
        const { rects, engine, ts0strip } = setup();
        rects.set(ts0strip, 10, 20, 196, 40);
        engine.run("measure-and-position");
        expect(read(engine).minHeight).toBe(41);
        read(engine);
        expect(sizeRanges).toHaveBeenCalledTimes(1);
        expect(computePaths).not.toHaveBeenCalled();
    });

    it("keeps the ranges when a tab strip moves without a new height", () => {
        const { rects, engine, ts0strip } = setup();
        rects.set(ts0strip, 12, 22, 190, 30.2);
        engine.run("measure-and-position");
        expect(read(engine).minHeight).toBe(31);
        expect(sizeRanges).not.toHaveBeenCalled();
    });

    it("recomputes the ranges when the splitter size changes", () => {
        const { rects, engine, splitter } = setup();
        rects.set(splitter, 206, 20, 12, 300);
        engine.run("measure-and-position");
        read(engine);
        read(engine);
        expect(sizeRanges).toHaveBeenCalledTimes(1);
        expect(computePaths).not.toHaveBeenCalled();
    });

    it("rebuilds no path while a splitter is dragged in realtime", () => {
        const { model, rects, engine, root, splitter } = setup();
        rects.set(splitter, 0, 0, 0, 0);
        const own = rects.set(
            root.appendChild(document.createElement("div")),
            206,
            20,
            8,
            300,
        );
        const controller = createSplitterController(engine, "row", 1);
        controller.attach(own);
        vi.mocked(computePaths).mockClear();
        for (const weight of [40, 42, 44, 46, 48]) {
            model.run(
                "row.resize",
                { rowId: "row", weights: [weight, 100 - weight] },
                { transient: true },
            );
        }
        expect(computePaths).not.toHaveBeenCalled();
        controller.dispose();
    });

    it("knows each row's orientation, flipped at every level", () => {
        const tabset = (id: string, tab: string) => ({
            type: "tabset" as const,
            id,
            children: [{ id: tab, component: "test", label: tab }],
        });
        const nested: LayoutJson = {
            version: 1,
            root: {
                type: "row",
                id: "row",
                children: [
                    {
                        type: "row",
                        id: "inner",
                        children: [
                            {
                                type: "row",
                                id: "deep",
                                children: [
                                    tabset("ts0", "t0"),
                                    tabset("ts2", "t3"),
                                ],
                            },
                            tabset("ts3", "t4"),
                        ],
                    },
                    tabset("ts1", "t2"),
                ],
            },
        };
        const { model, engine } = setup(nested);
        expect(engine.adapter.rowOrientation("row")).toBe("horizontal");
        expect(engine.adapter.rowOrientation("inner")).toBe("vertical");
        expect(engine.adapter.rowOrientation("deep")).toBe("horizontal");
        model.run("layout.configure", {
            defaults: { layout: { rootOrientation: "vertical" } },
        });
        expect(engine.adapter.rowOrientation("row")).toBe("vertical");
        expect(engine.adapter.rowOrientation("inner")).toBe("horizontal");
    });
});

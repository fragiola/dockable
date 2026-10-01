// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    createLayoutEngine,
    type LayoutEngine,
    MOVEABLE_ATTRIBUTE,
    MOVEABLES_HOME_ATTRIBUTE,
} from "../../src";
import {
    freshModel,
    mountTwoTabsets,
    RecordingResizeObserver,
    Rects,
    recordCommands,
    twoTabsets,
} from "./fixture";

const STRUCTURAL = new Set([
    "position",
    "left",
    "top",
    "width",
    "height",
    "display",
]);

function styleKeys(element: HTMLElement) {
    return Array.from({ length: element.style.length }, (_, i) =>
        element.style.item(i),
    );
}

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

function setup() {
    const model = freshModel();
    const rects = new Rects();
    engine = createLayoutEngine({ model, measure: rects.measure });
    const dom = mountTwoTabsets(engine, rects);
    return { model, rects, engine, ...dom };
}

describe("LayoutEngine measure pass", () => {
    it("measures registered elements relative to the root, into the engine (never the model)", () => {
        const { model, engine } = setup();
        const before = model.state;
        expect(engine.adapter.syncLayoutMetrics()).toBe(true);
        expect(engine.adapter.rect("row", "row")).toEqual({
            x: 0,
            y: 0,
            width: 400,
            height: 300,
        });
        expect(engine.adapter.rect("tabset", "ts0")).toEqual({
            x: 0,
            y: 0,
            width: 196,
            height: 300,
        });
        expect(engine.adapter.contentRect("ts0")).toEqual({
            x: 0,
            y: 30,
            width: 196,
            height: 270,
        });
        expect(engine.adapter.contentRect("ts1")).toEqual({
            x: 204,
            y: 30,
            width: 196,
            height: 270,
        });
        expect(model.state).toBe(before);
    });

    it("uses the injected measure function", () => {
        const model = freshModel();
        const measure = vi.fn(() => ({ x: 1, y: 2, width: 3, height: 4 }));
        engine = createLayoutEngine({ model, measure });
        const root = document.body.appendChild(document.createElement("div"));
        engine.adapter.attachRoot(root);
        const el = root.appendChild(document.createElement("div"));
        expect(engine.adapter.rectInLayout(el)).toEqual({
            x: 0,
            y: 0,
            width: 3,
            height: 4,
        });
        expect(engine.adapter.getDomRect()).toEqual({
            x: 1,
            y: 2,
            width: 3,
            height: 4,
        });
        expect(measure).toHaveBeenCalledWith(el);
    });

    it("counts only rounded changes", () => {
        const { rects, engine, ts0 } = setup();
        engine.adapter.syncLayoutMetrics();
        expect(engine.adapter.syncLayoutMetrics()).toBe(false);
        rects.set(ts0, 10.2, 20.2, 196.3, 300.1); // sub-pixel jitter
        expect(engine.adapter.syncLayoutMetrics()).toBe(false);
        rects.set(ts0, 10, 20, 180, 300);
        expect(engine.adapter.syncLayoutMetrics()).toBe(true);
    });

    it("skips elements that are not connected", () => {
        const { engine, ts0 } = setup();
        ts0.remove();
        engine.adapter.syncLayoutMetrics();
        expect(engine.adapter.rect("tabset", "ts0")).toBeUndefined();
    });

    it("asks for a relayout the first time a content area gains a size, and only then", () => {
        const { engine } = setup();
        const listener = vi.fn();
        engine.adapter.subscribe(listener);
        const before = engine.adapter.getSnapshot();
        engine.run("measure-and-position");
        expect(listener).toHaveBeenCalledTimes(1);
        expect(engine.adapter.getSnapshot()).not.toBe(before);
        listener.mockClear();
        engine.run("measure-and-position");
        expect(listener).not.toHaveBeenCalled();
    });

    it("discovers the splitter thickness", () => {
        const { rects, engine, splitter } = setup();
        engine.run("measure-and-position");
        expect(engine.get("splitter-size")).toBe(8);
        rects.set(splitter, 206, 20, 12, 300);
        const listener = vi.fn();
        engine.adapter.subscribe(listener);
        engine.run("measure-and-position");
        expect(engine.get("splitter-size")).toBe(12);
        expect(listener).toHaveBeenCalled();
    });

    it("ignores a hidden splitter", () => {
        const { rects, engine, splitter } = setup();
        rects.set(splitter, 0, 0, 0, 0);
        engine.run("measure-and-position");
        expect(engine.get("splitter-size")).toBe(8);
    });

    it("computes paths and size ranges per state", () => {
        const { engine } = setup();
        engine.run("measure-and-position");
        engine.adapter.prepare();
        expect(engine.get("path", { node: "ts1" })).toBe("/ts1");
        expect(engine.get("path", { node: "t2" })).toBe("/ts1/t0");
        // a tabset's minimum height includes its strip
        expect(engine.get("size-limits", { node: "ts0" }).minHeight).toBe(31);
    });
});

describe("LayoutEngine panel positioning", () => {
    it("writes only structural style onto the panels", () => {
        const { engine, panels } = setup();
        engine.run("measure-and-position");
        for (const panel of Object.values(panels)) {
            for (const key of styleKeys(panel)) {
                expect(STRUCTURAL.has(key), `unexpected style ${key}`).toBe(
                    true,
                );
            }
        }
        expect(panels.t0.style.position).toBe("absolute");
        expect(panels.t0.style.left).toBe("0px");
        expect(panels.t0.style.top).toBe("30px");
        expect(panels.t0.style.width).toBe("196px");
        expect(panels.t0.style.height).toBe("270px");
        expect(panels.t2.style.left).toBe("204px");
    });

    it("shows the selected tab and hides the others", () => {
        const { engine, panels } = setup();
        engine.run("measure-and-position");
        expect(panels.t0.style.display).toBe("");
        expect(panels.t1.style.display).toBe("none");
        expect(panels.t2.style.display).toBe("");
        expect(engine.is("panel-visible", { tab: "t0" })).toBe(true);
        expect(engine.is("panel-visible", { tab: "t1" })).toBe(false);
    });

    it("hides panels of non-maximized tabsets while one is maximized", () => {
        const { model, engine, panels } = setup();
        engine.run("measure-and-position");
        model.run("tabset.maximize", { tabsetId: "ts1", value: true });
        engine.run("measure-and-position");
        expect(panels.t0.style.display).toBe("none");
        expect(panels.t2.style.display).toBe("");
    });
});

describe("LayoutEngine and the model", () => {
    it("runs commands through the model, so middleware applies", () => {
        const { model, engine } = setup();
        const commands = recordCommands(model);
        engine.adapter.model.run("tab.select", { tabId: "t1" });
        expect(model.get("selected-tab", { container: "ts0" })?.id).toBe("t1");
        expect(commands).toEqual([
            { command: "tab.select", payload: { tabId: "t1" } },
        ]);
    });

    it("re-renders after every commit, the engine's and the app's", () => {
        const { model, engine } = setup();
        const listener = vi.fn();
        engine.adapter.subscribe(listener);
        model.run("tab.move", { tabId: "t2", to: "ts0" });
        expect(listener).toHaveBeenCalled();
    });

    it("applies a transient row.resize without a re-render, writing flex-grow directly", () => {
        const { model, engine, ts0, ts1 } = setup();
        engine.run("measure-and-position");
        const listener = vi.fn();
        engine.adapter.subscribe(listener);
        model.run(
            "row.resize",
            { rowId: "row", weights: [30, 70] },
            { transient: true },
        );
        expect(listener).not.toHaveBeenCalled();
        expect(ts0.style.flexGrow).toBe(String(30 * 1000));
        expect(ts1.style.flexGrow).toBe(String(70 * 1000));
        expect(model.get("node", { node: "ts0" })).toMatchObject({
            weight: 30,
        });
        model.run("row.resize", { rowId: "row", weights: [30, 70] });
        expect(listener).toHaveBeenCalled();
    });
});

describe("LayoutEngine moveable elements", () => {
    it("creates them on first use in the layout's document, marked with data-dockable-moveable", () => {
        const { engine } = setup();
        const element = engine.adapter.getMoveableElement("t0");
        expect(element.hasAttribute(MOVEABLE_ATTRIBUTE)).toBe(true);
        expect(element.ownerDocument).toBe(
            engine.adapter.getLayoutRef()?.ownerDocument,
        );
        expect(engine.adapter.getMoveableElement("t0")).toBe(element);
        expect(styleKeys(element).sort()).toEqual(["height", "width"]);
    });

    it("keeps the same element through release and attach into another panel", () => {
        const { engine, panels } = setup();
        engine.adapter.attachMoveable("t0", panels.t0);
        const element = engine.adapter.getMoveableElement("t0");
        const content = element.appendChild(document.createElement("input"));
        content.value = "typed";
        expect(element.parentElement).toBe(panels.t0);

        engine.adapter.releaseMoveable("t0", panels.t0);
        expect(element.isConnected).toBe(true);
        expect(
            element.parentElement?.hasAttribute(MOVEABLES_HOME_ATTRIBUTE),
        ).toBe(true);

        const otherPanel = document.body.appendChild(
            document.createElement("div"),
        );
        engine.adapter.attachMoveable("t0", otherPanel);
        expect(engine.adapter.getMoveableElement("t0")).toBe(element);
        expect(element.parentElement).toBe(otherPanel);
        expect(element.firstChild).toBe(content);
        expect(content.value).toBe("typed");
    });

    it("does not park an element that already moved to another panel", () => {
        const { engine, panels } = setup();
        engine.adapter.attachMoveable("t0", panels.t0);
        engine.adapter.attachMoveable("t0", panels.t1);
        engine.adapter.releaseMoveable("t0", panels.t0);
        expect(engine.adapter.getMoveableElement("t0").parentElement).toBe(
            panels.t1,
        );
    });

    it("scrolls the content unless the panel is not scrollable", () => {
        const { engine, panels } = setup();
        engine.adapter.attachMoveable("t0", panels.t0);
        expect(engine.adapter.getMoveableElement("t0").style.overflow).toBe(
            "auto",
        );
        engine.adapter.attachMoveable("t0", panels.t0, { scrollable: false });
        expect(engine.adapter.getMoveableElement("t0").style.overflow).toBe(
            "hidden",
        );
    });

    it("keeps every moveable of a tab whose id survives a layout.load", () => {
        const { model, engine, panels } = setup();
        engine.adapter.attachMoveable("t0", panels.t0);
        const t0 = engine.adapter.getMoveableElement("t0");
        const t2 = engine.adapter.getMoveableElement("t2");
        const moved = structuredClone(twoTabsets);
        // the same ids, rearranged: t2 joins ts0, ts1 goes
        moved.root.children = [
            {
                type: "tabset",
                id: "ts0",
                children: [
                    { id: "t2", component: "test" },
                    { id: "t0", component: "test" },
                ],
            },
        ];
        const result = model.run("layout.load", { layout: moved });
        expect(result.ok && result.value.removedNodeIds.sort()).toEqual([
            "t1",
            "ts1",
        ]);
        expect(engine.adapter.getMoveableElement("t0")).toBe(t0);
        expect(engine.adapter.getMoveableElement("t2")).toBe(t2);
        expect(t0.parentElement).toBe(panels.t0);
    });

    it("releases the moveable of a tab the model no longer has", () => {
        const { model, engine } = setup();
        const t1 = engine.adapter.getMoveableElement("t1");
        model.run("tab.close", { tabId: "t1" });
        expect(engine.adapter.getMoveableElement("t1")).not.toBe(t1);
    });

    it("renders a tab's content once its content area has a size, then keeps it rendered", () => {
        const { model, engine } = setup();
        expect(engine.adapter.shouldRender("t0")).toBe(false); // not measured yet
        engine.run("measure-and-position");
        expect(engine.adapter.shouldRender("t0")).toBe(true);
        expect(engine.adapter.shouldRender("t1")).toBe(false); // not selected
        expect(engine.adapter.shouldRender("t1", false)).toBe(true); // render on demand off
        model.run("tab.select", { tabId: "t0" });
        expect(engine.adapter.shouldRender("t1")).toBe(true); // rendered before
    });
});

describe("LayoutEngine registration bookkeeping", () => {
    it("is idempotent: a StrictMode-style double register/unregister leaves no stale entries", () => {
        const { engine, ts0 } = setup();
        const observer = RecordingResizeObserver.instances[0];
        expect(observer?.observed.has(ts0)).toBe(true);
        engine.adapter.registerMeasurable("ts0", "tabset", ts0);
        engine.adapter.registerMeasurable("ts0", "tabset", null);
        expect(observer?.observed.has(ts0)).toBe(false);
        engine.adapter.registerMeasurable("ts0", "tabset", ts0);
        engine.adapter.registerMeasurable("ts0", "tabset", ts0);
        expect(engine.adapter.getRegistrations().measurables.size).toBe(7);
        expect(observer?.observed.has(ts0)).toBe(true);
        engine.adapter.registerTabPanel("t0", null);
        engine.adapter.registerTabPanel("t0", null);
        expect(engine.adapter.getRegistrations().tabPanels.size).toBe(2);
    });

    it("watches tab buttons: a tab that grows can make its strip overflow", () => {
        const { engine, root } = setup();
        const button = root.appendChild(document.createElement("div"));
        engine.adapter.registerMeasurable("t0", "tabbutton", button);
        expect(RecordingResizeObserver.instances[0]?.observed.has(button)).toBe(
            true,
        );
    });

    it("attachRoot twice with the same element keeps a single observer and model listener", () => {
        const { model, engine, root } = setup();
        engine.adapter.attachRoot(root);
        expect(RecordingResizeObserver.instances).toHaveLength(1);
        const listener = vi.fn();
        engine.adapter.subscribe(listener);
        model.run("tab.select", { tabId: "t1" });
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it("detachRoot releases the observer and the model listener; attachRoot restores them", () => {
        const { model, engine, root } = setup();
        const listener = vi.fn();
        engine.adapter.subscribe(listener);
        engine.adapter.detachRoot();
        expect(RecordingResizeObserver.instances[0]?.disconnected).toBe(true);
        expect(root.querySelector(`[${MOVEABLES_HOME_ATTRIBUTE}]`)).toBeNull();
        model.run("tab.select", { tabId: "t1" });
        expect(listener).not.toHaveBeenCalled();
        engine.adapter.attachRoot(root);
        model.run("tab.select", { tabId: "t0" });
        expect(listener).toHaveBeenCalledTimes(1);
        expect(
            root.querySelectorAll(`[${MOVEABLES_HOME_ATTRIBUTE}]`),
        ).toHaveLength(1);
    });
});

describe("LayoutEngine keyboard focus", () => {
    it("moves focus to the selected tab button of the adjacent tabset and activates it", () => {
        const { model, engine, root } = setup();
        const b0 = root.appendChild(document.createElement("button"));
        const b2 = root.appendChild(document.createElement("button"));
        engine.adapter.registerMeasurable("t0", "tabbutton", b0);
        engine.adapter.registerMeasurable("t2", "tabbutton", b2);
        b0.focus();
        model.run("tabset.activate", { tabsetId: "ts0" });
        expect(engine.can("focus-tabset", { direction: "next" })).toBe(true);
        expect(document.activeElement).toBe(b0); // a dry run moves nothing
        expect(engine.run("focus-tabset", { direction: "next" })).toEqual({
            ok: true,
            value: { tabsetId: "ts1" },
        });
        expect(document.activeElement).toBe(b2);
        expect(model.get("active-tabset")?.id).toBe("ts1");
        expect(engine.run("focus-tabset", { direction: "previous" }).ok).toBe(
            true,
        );
        expect(document.activeElement).toBe(b0);
    });

    it("leaves text inputs alone", () => {
        const { engine, root } = setup();
        const input = root.appendChild(document.createElement("input"));
        input.focus();
        expect(engine.run("focus-tabset", { direction: "next" })).toMatchObject(
            {
                ok: false,
                error: { code: "refused" },
            },
        );
    });
});

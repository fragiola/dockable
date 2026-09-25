// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    type Action,
    Actions,
    createLayoutEngine,
    DockLocation,
    LayoutEngine,
    MOVEABLE_ATTRIBUTE,
    MOVEABLES_HOME_ATTRIBUTE,
    Rect,
    type RowNode,
    type TabNode,
    type TabSetNode,
} from "../../src";
import {
    freshModel,
    mountTwoTabsets,
    node,
    RecordingResizeObserver,
    Rects,
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
    engine?.dispose();
    engine = undefined;
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
});

function setup(
    options: { onAction?: (action: Action) => Action | undefined } = {},
) {
    const model = freshModel();
    const rects = new Rects();
    engine = createLayoutEngine({ model, measure: rects.measure, ...options });
    const dom = mountTwoTabsets(engine, rects);
    return { model, rects, engine, ...dom };
}

describe("LayoutEngine measure pass", () => {
    it("writes registered element rects into the model, relative to the root", () => {
        const { model, engine } = setup();
        expect(engine.syncLayoutMetrics()).toBe(true);

        expect(node<RowNode>(model, "row").getRect()).toEqual(
            new Rect(0, 0, 400, 300),
        );
        expect(node<TabSetNode>(model, "ts0").getRect()).toEqual(
            new Rect(0, 0, 196, 300),
        );
        expect(node<TabSetNode>(model, "ts0").getContentRect()).toEqual(
            new Rect(0, 30, 196, 270),
        );
        expect(node<TabSetNode>(model, "ts1").getContentRect()).toEqual(
            new Rect(204, 30, 196, 270),
        );
    });

    it("uses the injected measure function (the port of Rect.getBoundingClientRect)", () => {
        const model = freshModel();
        const measure = vi.fn(() => ({ x: 1, y: 2, width: 3, height: 4 }));
        engine = createLayoutEngine({ model, measure });
        const root = document.body.appendChild(document.createElement("div"));
        engine.attachRoot(root);
        const el = root.appendChild(document.createElement("div"));
        expect(engine.getBoundingClientRect(el)).toEqual(new Rect(0, 0, 3, 4));
        expect(engine.getDomRect()).toEqual(new Rect(1, 2, 3, 4));
        expect(measure).toHaveBeenCalledWith(el);
    });

    it("counts only rounded changes", () => {
        const { rects, engine, ts0 } = setup();
        engine.syncLayoutMetrics();
        expect(engine.syncLayoutMetrics()).toBe(false);

        rects.set(ts0, 10.2, 20.2, 196.3, 300.1); // sub-pixel jitter
        expect(engine.syncLayoutMetrics()).toBe(false);

        rects.set(ts0, 10, 20, 180, 300);
        expect(engine.syncLayoutMetrics()).toBe(true);
    });

    it("skips elements that are not connected", () => {
        const { model, engine, ts0 } = setup();
        ts0.remove();
        engine.syncLayoutMetrics();
        expect(node<TabSetNode>(model, "ts0").getRect()).toEqual(Rect.empty());
    });

    it("asks for a relayout the first time a content area gains a size, and only then", () => {
        const { engine } = setup();
        const listener = vi.fn();
        engine.subscribe(listener);
        const before = engine.getSnapshot();

        engine.sync();
        expect(listener).toHaveBeenCalledTimes(1);
        expect(engine.getSnapshot()).not.toBe(before);

        listener.mockClear();
        engine.sync();
        expect(listener).not.toHaveBeenCalled();
    });

    it("feeds the registered splitter thickness to the model", () => {
        const { model, rects, engine, splitter } = setup();
        engine.sync();
        expect(model.getSplitterSize()).toBe(8);

        rects.set(splitter, 206, 20, 12, 300);
        const listener = vi.fn();
        engine.subscribe(listener);
        engine.sync();
        expect(model.getSplitterSize()).toBe(12);
        expect(listener).toHaveBeenCalled();
    });

    it("ignores a hidden splitter", () => {
        const { model, rects, engine, splitter } = setup();
        rects.set(splitter, 0, 0, 0, 0);
        engine.sync();
        expect(model.getSplitterSize()).toBe(8);
    });
});

describe("LayoutEngine panel positioning", () => {
    it("writes only structural style onto the panels", () => {
        const { engine, panels } = setup();
        engine.sync();

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
        engine.sync();
        expect(panels.t0.style.display).toBe("");
        expect(panels.t1.style.display).toBe("none");
        expect(panels.t2.style.display).toBe("");
    });

    it("hides panels of non-maximized tabsets while one is maximized", () => {
        const { model, engine, panels } = setup();
        engine.sync();
        model.doAction(Actions.maximizeToggle("ts1"));
        engine.sync();
        expect(panels.t0.style.display).toBe("none");
        expect(panels.t2.style.display).toBe("");
    });

    it("fires tab resize and visibility events", () => {
        const { model, rects, engine, ts0content } = setup();
        const t0 = node<TabNode>(model, "t0");
        const t1 = node<TabNode>(model, "t1");
        const resize = vi.fn();
        const visibility = vi.fn();
        t0.setEventListener("resize", resize);
        t1.setEventListener("visibility", visibility);

        engine.sync();
        expect(resize).toHaveBeenCalledTimes(1);

        rects.set(ts0content, 10, 50, 150, 270);
        engine.sync();
        expect(resize).toHaveBeenCalledTimes(2);

        model.doAction(Actions.selectTab("t1"));
        engine.sync();
        expect(visibility).toHaveBeenLastCalledWith({ visible: true });
    });
});

describe("LayoutEngine actions", () => {
    it("passes actions through when there is no onAction", () => {
        const { model, engine } = setup();
        engine.doAction(Actions.selectTab("t1"));
        expect(node<TabSetNode>(model, "ts0").getSelectedNode()?.getId()).toBe(
            "t1",
        );
    });

    it("applies the action onAction returns, which may be a replacement", () => {
        const onAction = vi.fn(() => Actions.selectTab("t1"));
        const { model, engine } = setup({ onAction });
        engine.doAction(Actions.deleteTab("t2"));
        expect(onAction).toHaveBeenCalledTimes(1);
        expect(model.getNodeById("t2")).toBeDefined();
        expect(node<TabSetNode>(model, "ts0").getSelectedNode()?.getId()).toBe(
            "t1",
        );
    });

    it("vetoes the action when onAction returns undefined", () => {
        const { model, engine } = setup({ onAction: () => undefined });
        engine.doAction(Actions.deleteTab("t2"));
        expect(model.getNodeById("t2")).toBeDefined();
    });

    it("re-renders after a model change and reports it to onModelChange", () => {
        const model = freshModel();
        const rects = new Rects();
        const onModelChange = vi.fn();
        engine = createLayoutEngine({
            model,
            measure: rects.measure,
            onModelChange,
        });
        mountTwoTabsets(engine, rects);
        const listener = vi.fn();
        engine.subscribe(listener);

        engine.doAction(Actions.moveNode("t2", "ts0", DockLocation.CENTER, -1));
        expect(listener).toHaveBeenCalled();
        expect(onModelChange).toHaveBeenCalledWith(
            model,
            expect.objectContaining({ type: Actions.MOVE_NODE }),
        );
    });

    it("takes the adjusting fast path for weight changes: no re-render, flex-grow written directly", () => {
        const { model, engine, ts0, ts1 } = setup();
        engine.sync();
        const listener = vi.fn();
        engine.subscribe(listener);

        engine.doAction(
            Actions.adjustWeights("row", [30, 70]).setAdjusting(true),
        );
        expect(listener).not.toHaveBeenCalled();
        expect(ts0.style.flexGrow).toBe(String(30 * 1000));
        expect(ts1.style.flexGrow).toBe(String(70 * 1000));
        expect(node<TabSetNode>(model, "ts0").getWeight()).toBe(30);

        engine.doAction(Actions.adjustWeights("row", [30, 70]));
        expect(listener).toHaveBeenCalled();
    });
});

describe("LayoutEngine moveable elements", () => {
    it("creates them lazily in the layout's document, marked with data-dockable-moveable", () => {
        const { model, engine } = setup();
        const t0 = node<TabNode>(model, "t0");
        const create = vi.spyOn(engine, "createMoveableElement");
        expect(create).not.toHaveBeenCalled();

        const element = engine.getMoveableElement(t0);
        expect(create).toHaveBeenCalledTimes(1);
        expect(element.hasAttribute(MOVEABLE_ATTRIBUTE)).toBe(true);
        expect(element.ownerDocument).toBe(
            engine.getLayoutRef()?.ownerDocument,
        );
        expect(engine.getMoveableElement(t0)).toBe(element);
        expect(styleKeys(element).sort()).toEqual(["height", "width"]);
    });

    it("keeps the same element through release and attach into another panel", () => {
        const { model, engine, panels } = setup();
        const t0 = node<TabNode>(model, "t0");
        engine.attachMoveable(t0, panels.t0);
        const element = engine.getMoveableElement(t0);
        const content = element.appendChild(document.createElement("input"));
        content.value = "typed";
        expect(element.parentElement).toBe(panels.t0);

        engine.releaseMoveable(t0, panels.t0);
        expect(element.isConnected).toBe(true);
        expect(
            element.parentElement?.hasAttribute(MOVEABLES_HOME_ATTRIBUTE),
        ).toBe(true);

        const otherPanel = document.body.appendChild(
            document.createElement("div"),
        );
        engine.attachMoveable(t0, otherPanel);
        expect(engine.getMoveableElement(t0)).toBe(element);
        expect(element.parentElement).toBe(otherPanel);
        expect(element.firstChild).toBe(content);
        expect(content.value).toBe("typed");
    });

    it("does not park an element that already moved to another panel", () => {
        const { model, engine, panels } = setup();
        const t0 = node<TabNode>(model, "t0");
        engine.attachMoveable(t0, panels.t0);
        engine.attachMoveable(t0, panels.t1);
        engine.releaseMoveable(t0, panels.t0);
        expect(engine.getMoveableElement(t0).parentElement).toBe(panels.t1);
    });

    it("sets overflow from the tab's scrollbar setting", () => {
        const { model, engine, panels } = setup();
        const t0 = node<TabNode>(model, "t0");
        engine.attachMoveable(t0, panels.t0);
        expect(engine.getMoveableElement(t0).style.overflow).toBe("auto");
    });
});

describe("LayoutEngine registration bookkeeping", () => {
    it("is idempotent: a StrictMode-style double register/unregister leaves no stale entries", () => {
        const { model, engine, ts0 } = setup();
        const tabset = node<TabSetNode>(model, "ts0");
        const observer = RecordingResizeObserver.instances[0];
        expect(observer?.observed.has(ts0)).toBe(true);

        engine.registerMeasurable(tabset, "tabset", ts0);
        engine.registerMeasurable(tabset, "tabset", null);
        expect(observer?.observed.has(ts0)).toBe(false);
        engine.registerMeasurable(tabset, "tabset", ts0);
        engine.registerMeasurable(tabset, "tabset", ts0);
        expect(engine.getRegistrations().measurables.size).toBe(5);
        expect(observer?.observed.has(ts0)).toBe(true);

        engine.registerTabPanel(node<TabNode>(model, "t0"), null);
        engine.registerTabPanel(node<TabNode>(model, "t0"), null);
        expect(engine.getRegistrations().tabPanels.size).toBe(2);
    });

    it("does not watch tab buttons", () => {
        const { model, engine, root } = setup();
        const button = root.appendChild(document.createElement("div"));
        engine.registerMeasurable(
            node<TabNode>(model, "t0"),
            "tabbutton",
            button,
        );
        expect(RecordingResizeObserver.instances[0]?.observed.has(button)).toBe(
            false,
        );
    });

    it("attachRoot twice with the same element keeps a single observer and model listener", () => {
        const { model, engine, root } = setup();
        engine.attachRoot(root);
        expect(RecordingResizeObserver.instances).toHaveLength(1);
        const listener = vi.fn();
        engine.subscribe(listener);
        model.doAction(Actions.selectTab("t1"));
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it("detachRoot releases the observer and the model listener; attachRoot restores them", () => {
        const { model, engine, root } = setup();
        const listener = vi.fn();
        engine.subscribe(listener);
        engine.detachRoot();
        expect(RecordingResizeObserver.instances[0]?.disconnected).toBe(true);
        expect(root.querySelector(`[${MOVEABLES_HOME_ATTRIBUTE}]`)).toBeNull();

        model.doAction(Actions.selectTab("t1"));
        expect(listener).not.toHaveBeenCalled();

        engine.attachRoot(root);
        model.doAction(Actions.selectTab("t0"));
        expect(listener).toHaveBeenCalledTimes(1);
        expect(
            root.querySelectorAll(`[${MOVEABLES_HOME_ATTRIBUTE}]`),
        ).toHaveLength(1);
    });

    it("gives each window a stable id", () => {
        const { engine } = setup();
        const id = engine.getWindowId();
        expect(id).toMatch(/[0-9a-f-]{36}/);
        const other = createLayoutEngine({ model: freshModel() });
        other.attachRoot(
            document.body.appendChild(document.createElement("div")),
        );
        expect(other.getWindowId()).toBe(id);
        other.dispose();
    });
});

describe("LayoutEngine keyboard focus", () => {
    it("moves focus to the selected tab button of the adjacent tabset and activates it", () => {
        const { model, engine, root } = setup();
        const b0 = root.appendChild(document.createElement("button"));
        const b2 = root.appendChild(document.createElement("button"));
        engine.registerMeasurable(node<TabNode>(model, "t0"), "tabbutton", b0);
        engine.registerMeasurable(node<TabNode>(model, "t2"), "tabbutton", b2);
        b0.focus();
        model.doAction(Actions.setActiveTabset("ts0"));

        expect(engine.focusAdjacentTabset(1)).toBe(true);
        expect(document.activeElement).toBe(b2);
        expect(model.getActiveTabset()?.getId()).toBe("ts1");

        expect(engine.focusAdjacentTabset(1)).toBe(true);
        expect(document.activeElement).toBe(b0);
    });

    it("leaves text inputs alone", () => {
        const { engine, root } = setup();
        const input = root.appendChild(document.createElement("input"));
        input.focus();
        expect(engine.focusAdjacentTabset(1)).toBe(false);
    });
});

describe("LayoutEngine.of", () => {
    it("finds the engine driving a model's main layout, until it is disposed", () => {
        const model = freshModel();
        expect(LayoutEngine.of(model)).toBeUndefined();
        const engine = createLayoutEngine({ model });
        expect(LayoutEngine.of(model)).toBe(engine);
        engine.dispose();
        expect(LayoutEngine.of(model)).toBeUndefined();
    });
});

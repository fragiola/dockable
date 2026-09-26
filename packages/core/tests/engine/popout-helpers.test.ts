// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    Actions,
    createLayoutEngine,
    type LayoutEngine,
    Model,
    type TabNode,
    type TabSetNode,
} from "../../src";
import { freshModel, node } from "./fixture";

const engines: LayoutEngine[] = [];
afterEach(() => {
    for (const engine of engines.splice(0)) engine.dispose();
});

function setup(
    supportsPopout = true,
    onAction = (a: import("../../src").Action) => a,
) {
    const model = freshModel();
    // popout is opt-in per tab (enablePopout defaults to false)
    model.doAction(Actions.updateModelAttributes({ tabEnablePopout: true }));
    const engine = createLayoutEngine({
        model,
        onAction,
        popout: { supportsPopout },
    });
    engines.push(engine);
    return { model, engine };
}

function windowLayoutId(model: Model) {
    return [...model.getLayouts().keys()].find(
        (id) => id !== Model.MAIN_LAYOUT_ID,
    ) as string;
}

describe("popout helpers", () => {
    it("canPopout: supported, not already in a window, and enabled", () => {
        const { model, engine } = setup();
        const t0 = node<TabNode>(model, "t0");
        const ts1 = node<TabSetNode>(model, "ts1");
        expect(engine.canPopout(t0)).toBe(true);
        expect(engine.canPopout(ts1)).toBe(true);

        model.doAction(
            Actions.updateNodeAttributes("t0", { enablePopout: false }),
        );
        expect(engine.canPopout(t0)).toBe(false);
        expect(engine.canPopout(node<TabSetNode>(model, "ts0"))).toBe(false); // one tab refuses

        const unsupported = setup(false);
        expect(
            unsupported.engine.canPopout(
                node<TabNode>(unsupported.model, "t2"),
            ),
        ).toBe(false);
    });

    it("popout() pops a tab or a whole tabset into a window layout, through onAction", () => {
        const seen: string[] = [];
        const { model, engine } = setup(true, (action) => {
            seen.push(action.type);
            return action;
        });
        engine.popout(node<TabSetNode>(model, "ts0"));
        expect(seen).toEqual([Actions.POPOUT_TABSET]);
        const layoutId = windowLayoutId(model);
        expect(model.getLayouts().get(layoutId)?.getType()).toBe("window");
        const t0 = node<TabNode>(model, "t0");
        const t1 = node<TabNode>(model, "t1");
        expect(t0.getLayoutId()).toBe(layoutId);
        expect(t1.getLayoutId()).toBe(layoutId);
        expect(engine.isInWindow(t0)).toBe(true);
        expect(engine.canPopout(t0)).toBe(false);
    });

    it("dockBack() moves a tab (or every tab of a tabset) into the main layout's active tabset", () => {
        const { model, engine } = setup();
        engine.popout(node<TabSetNode>(model, "ts0"));
        const windowTabset = node<TabNode>(
            model,
            "t0",
        ).getParent() as TabSetNode;
        engine.doAction(Actions.setActiveTabset("ts1", Model.MAIN_LAYOUT_ID));

        engine.dockBack(node<TabNode>(model, "t0"));
        expect(node<TabNode>(model, "t0").getParent()?.getId()).toBe("ts1");

        engine.dockBack(windowTabset);
        expect(
            node<TabSetNode>(model, "ts1")
                .getChildren()
                .map((c) => c.getId()),
        ).toEqual(["t2", "t0", "t1"]);
        // the emptied window layout is gone
        expect(model.getLayouts().size).toBe(1);
    });

    it("interceptAction runs onAction without applying the action", () => {
        const onAction = vi.fn((action: import("../../src").Action) => action);
        const { model, engine } = setup(true, onAction);
        const action = Actions.selectTab("t1");
        expect(engine.interceptAction(action)).toBe(action);
        expect(onAction).toHaveBeenCalledWith(action);
        expect(node<TabSetNode>(model, "ts0").getSelectedNode()?.getId()).toBe(
            "t0",
        );
        const vetoing = setup(true, () => undefined as never);
        expect(vetoing.engine.interceptAction(action)).toBeUndefined();
    });
});

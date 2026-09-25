// @vitest-environment jsdom
// Ported from FlexLayout (https://github.com/caplin/FlexLayout), tests/Model.test.ts
// ("restores horizontal scroll when vertical scroll is zero").
// Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see LICENSE.
import { describe, expect, it } from "vitest";
import { Model, Rect, type TabNode } from "../../src";
import type { ILayoutController } from "../../src/model/ILayoutController";

function attachController(model: Model): ILayoutController {
    const controller: ILayoutController = {
        getCurrentWindow: () => window,
        getWindowId: () => "main",
        getModel: () => model,
        getDomRect: () => Rect.empty(),
        getLayoutRef: () => null,
        createMoveableElement: () => {
            const element = document.createElement("div");
            element.setAttribute("data-dockable-moveable", "");
            return element;
        },
    };
    model.getMainLayout().setController(controller);
    return controller;
}

function oneTab() {
    return Model.fromJson({
        global: {},
        layout: {
            type: "row",
            children: [
                {
                    type: "tabset",
                    children: [{ type: "tab", id: "t1", name: "One" }],
                },
            ],
        },
    });
}

describe("TabNode moveable element", () => {
    it("restores horizontal scroll when vertical scroll is zero", async () => {
        const model = oneTab();
        attachController(model);
        const t = model.getNodeById("t1") as TabNode;
        const el = t.getMoveableElement();
        t.setScrollTop(0);
        t.setScrollLeft(123);

        t.restoreScrollPosition();
        await new Promise((resolve) => requestAnimationFrame(resolve));

        expect(el.scrollLeft).equal(123);
    });

    it("is created lazily through the layout controller, once", () => {
        const model = oneTab();
        let created = 0;
        const controller = attachController(model);
        const create = controller.createMoveableElement;
        controller.createMoveableElement = () => {
            created++;
            return create();
        };
        const t = model.getNodeById("t1") as TabNode;
        expect(created).toBe(0);
        const el = t.getMoveableElement();
        expect(t.getMoveableElement()).toBe(el);
        expect(created).toBe(1);
        expect(el.hasAttribute("data-dockable-moveable")).toBe(true);
    });

    it("throws when no controller is attached", () => {
        const t = oneTab().getNodeById("t1") as TabNode;
        expect(() => t.getMoveableElement()).toThrow(/no layout controller/);
    });
});

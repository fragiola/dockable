import {
    createModel,
    DRAG_TYPE,
    DragDropManager,
    type LayoutJson,
} from "@fragiola/dockable";
import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, h, nextTick } from "vue";
import { useDockable } from "../src";
import { byTestId, dragEvent, fakeDataTransfer, path } from "./drag";
import {
    Dockable,
    Layout,
    render,
    renderLayout,
    type Types,
    twoTabsets,
} from "./layout";

function freshModel(json: LayoutJson<Types> = twoTabsets) {
    return createModel<Types>(structuredClone(json));
}

afterEach(() => {
    if (DragDropManager.getDragState()) {
        DragDropManager.endDrag();
    }
});

describe("Dockable.Tab dragging", () => {
    it("is draggable only when the tab enables drag", async () => {
        const model = freshModel({
            version: 1,
            root: {
                type: "row",
                children: [
                    {
                        type: "tabset",
                        children: [
                            {
                                id: "a",
                                component: "test",
                                label: "A",
                                data: { name: "A" },
                            },
                            {
                                id: "b",
                                component: "test",
                                label: "B",
                                data: { name: "B" },
                                draggable: false,
                            },
                        ],
                    },
                ],
            },
        });
        await renderLayout(model);
        expect(path("/ts0/tb0")).toHaveAttribute("draggable", "true");
        expect(path("/ts0/tb1")).toHaveAttribute("draggable", "false");
    });

    it("starts a drag on dragstart, marking the tab and the root as dragging", async () => {
        const model = freshModel();
        await renderLayout(model);
        const tab = path("/ts0/tb1");
        const dataTransfer = fakeDataTransfer([]);
        tab.dispatchEvent(dragEvent("dragstart", 10, 10, dataTransfer));
        await nextTick();
        const subject = DragDropManager.getDragState()?.subjectOf(model);
        expect(subject?.kind === "tab" ? subject.tab.id : undefined).toBe("t1");
        // the drag carries Dockable's type, so the layouts claim its events
        expect(dataTransfer.types).toContain(DRAG_TYPE);
        expect(tab).toHaveAttribute("data-dragging", "");
        expect(path("/layout")).toHaveAttribute("data-dragging", "");
        expect(path("/ts0/tb0")).not.toHaveAttribute("data-dragging");

        tab.dispatchEvent(dragEvent("dragend", 10, 10, dataTransfer));
        await nextTick();
        expect(DragDropManager.getDragState()).toBeUndefined();
        expect(tab).not.toHaveAttribute("data-dragging");
        expect(path("/layout")).not.toHaveAttribute("data-dragging");
    });

    it("cancels the dragstart of a tab that cannot be dragged", async () => {
        const model = freshModel({
            version: 1,
            defaults: { tab: { draggable: false } },
            root: {
                type: "row",
                children: [
                    {
                        type: "tabset",
                        children: [
                            {
                                component: "test",
                                label: "A",
                                data: { name: "A" },
                            },
                        ],
                    },
                ],
            },
        });
        await renderLayout(model);
        const event = dragEvent("dragstart", 0, 0);
        path("/ts0/tb0").dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
        expect(DragDropManager.getDragState()).toBeUndefined();
    });
});

describe("Dockable.DropIndicator", () => {
    const DragFrom = defineComponent({
        name: "DragFrom",
        props: { tabId: { type: String, required: true } },
        setup(props) {
            const { engine } = useDockable<Types>();
            return () =>
                h("button", {
                    type: "button",
                    "data-testid": "start",
                    onClick: () =>
                        engine.adapter
                            .getDragDropManager()
                            .startDrag(
                                dragEvent("dragstart", 0, 0),
                                props.tabId,
                            ),
                });
        },
    });

    it("is hidden outside a drag and follows the computed drop rect during one", async () => {
        const model = freshModel();
        await renderLayout(model, {}, () => [
            h(Dockable.DropIndicator, { "data-testid": "indicator" }),
            h(DragFrom, { tabId: "t2" }),
        ]);
        const indicator = byTestId("indicator");
        expect(indicator).toHaveAttribute("data-layout-path", "/outline");
        expect(indicator).toHaveAttribute("aria-hidden", "true");
        expect(indicator.style.display).toBe("none");
        expect(indicator).not.toHaveAttribute("data-drop-location");

        byTestId("start").click();
        await nextTick();
        const root = path("/layout");
        root.dispatchEvent(dragEvent("dragenter", 50, 50));
        await nextTick();
        expect(indicator).toHaveAttribute("data-dragging", "");
        expect(indicator.style.display).toBe("none"); // 1x1 at the pointer, not yet over a target

        root.dispatchEvent(dragEvent("dragover", 50, 50));
        await nextTick();
        expect(indicator).toHaveAttribute("data-visible", "");
        expect(indicator.getAttribute("data-drop-location")).toMatch(
            /^(center|top|bottom|start|end)$/,
        );
        expect(indicator.getAttribute("data-drop-kind")).toMatch(
            /^(rect|edge)$/,
        );
        expect(indicator.style.display).toBe("");
        expect(indicator.style.position).toBe("absolute");
        const keys = Array.from({ length: indicator.style.length }, (_, i) =>
            indicator.style.item(i),
        ).sort();
        expect(keys).toEqual([
            "height",
            "left",
            "pointer-events",
            "position",
            "top",
            "width",
        ]);
        expect(indicator.style.pointerEvents).toBe("none");

        root.dispatchEvent(dragEvent("drop", 50, 50));
        await nextTick();
        expect(indicator.style.display).toBe("none");
        expect(indicator).not.toHaveAttribute("data-dragging");
    });

    it("gives the render slot the target's ids", async () => {
        const model = freshModel();
        const seen: (string | undefined)[] = [];
        await renderLayout(model, {}, () => [
            h(Dockable.DropIndicator, null, {
                render: ({
                    props,
                    state,
                }: {
                    props: Record<string, unknown>;
                    state: { targetTabsetId?: string; targetNodeId?: string };
                }) => {
                    seen.push(state.targetNodeId);
                    return [
                        h("div", {
                            ...props,
                            "data-testid": "indicator",
                            class: state.targetTabsetId
                                ? `into-${state.targetTabsetId}`
                                : "none",
                        }),
                    ];
                },
            }),
            h(DragFrom, { tabId: "t2" }),
        ]);
        const indicator = byTestId("indicator");
        expect(indicator).toHaveClass("none");
        byTestId("start").click();
        await nextTick();
        const root = path("/layout");
        root.dispatchEvent(dragEvent("dragenter", 50, 50));
        root.dispatchEvent(dragEvent("dragover", 50, 50));
        await nextTick();
        expect(byTestId("indicator")).toHaveClass("into-ts0");
        expect(seen.at(-1)).toBe("ts0");
        expect(seen.at(0)).toBeUndefined();
    });

    it("ignores drag events that do not carry Dockable's type", async () => {
        const model = freshModel();
        await renderLayout(model, {}, () => [
            h(Dockable.DropIndicator, { "data-testid": "indicator" }),
            h(DragFrom, { tabId: "t2" }),
        ]);
        byTestId("start").click();
        await nextTick();
        const root = path("/layout");
        const foreign = fakeDataTransfer(["text/plain"]);
        root.dispatchEvent(dragEvent("dragenter", 50, 50, foreign));
        root.dispatchEvent(dragEvent("dragover", 50, 50, foreign));
        await nextTick();
        const indicator = byTestId("indicator");
        expect(indicator).not.toHaveAttribute("data-visible");
        expect(indicator.style.display).toBe("none");
    });

    it("supports `as` and its default slot", async () => {
        const model = freshModel();
        await renderLayout(model, {}, () => [
            h(
                Dockable.DropIndicator,
                { as: "section", "data-testid": "indicator" },
                { default: () => [h("span", { "data-testid": "inside" })] },
            ),
        ]);
        expect(byTestId("indicator").tagName).toBe("SECTION");
        expect(byTestId("inside")).toBeInTheDocument();
    });

    it("renders no text of its own", async () => {
        const model = freshModel();
        await render(
            defineComponent({
                setup: () => () =>
                    h(
                        Dockable.Root,
                        { model },
                        {
                            default: () => [
                                h(Dockable.DropIndicator, {
                                    "data-testid": "indicator",
                                }),
                            ],
                        },
                    ),
            }),
        );
        expect(byTestId("indicator").textContent).toBe("");
        void Layout;
    });
});

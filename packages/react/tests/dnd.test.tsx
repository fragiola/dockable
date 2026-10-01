import {
    createModel,
    DRAG_TYPE,
    DragDropManager,
    type LayoutJson,
} from "@fragiola/dockable";
import { act, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Dockable, useDockable } from "../src";
import { Layout, type Types, twoTabsets } from "./layout";

const path = (p: string) => {
    const element = document.querySelector<HTMLElement>(
        `[data-layout-path="${p}"]`,
    );
    if (!element) throw new Error(`no element at ${p}`);
    return element;
};

function freshModel(json: LayoutJson<Types> = twoTabsets) {
    return createModel<Types>(structuredClone(json));
}

/** A fake DataTransfer: the types a drag carries (a Dockable drag carries DRAG_TYPE), and spies. */
function fakeDataTransfer(types: string[] = [DRAG_TYPE]) {
    return {
        types,
        setData: vi.fn((type: string, _data: string) => {
            if (!types.includes(type)) types.push(type);
        }),
        setDragImage: vi.fn<(image: Element, x: number, y: number) => void>(),
        effectAllowed: "none",
        dropEffect: "none",
    };
}

// jsdom has no DragEvent: a MouseEvent with a fake dataTransfer carries what the core reads
function dragEvent(
    type: string,
    x: number,
    y: number,
    dataTransfer = fakeDataTransfer(),
) {
    const event = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
    });
    Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
    return event as unknown as DragEvent;
}

afterEach(() => {
    if (DragDropManager.getDragState()) {
        act(() => {
            DragDropManager.endDrag();
        });
    }
});

describe("Dockable.Tab dragging", () => {
    it("is draggable only when the tab enables drag", () => {
        const model = freshModel({
            version: 1,
            root: {
                type: "row",
                children: [
                    {
                        type: "tabset",
                        children: [
                            { id: "a", component: "test", data: { name: "A" } },
                            {
                                id: "b",
                                component: "test",
                                data: { name: "B" },
                                enableDrag: false,
                            },
                        ],
                    },
                ],
            },
        });
        render(<Layout model={model} />);
        expect(path("/ts0/tb0")).toHaveAttribute("draggable", "true");
        expect(path("/ts0/tb1")).toHaveAttribute("draggable", "false");
    });

    it("starts a drag on dragstart, marking the tab and the root as dragging", () => {
        const model = freshModel();
        render(<Layout model={model} />);
        const tab = path("/ts0/tb1");
        const dataTransfer = fakeDataTransfer([]);
        act(() => {
            tab.dispatchEvent(dragEvent("dragstart", 10, 10, dataTransfer));
        });
        const subject = DragDropManager.getDragState()?.subjectOf(model);
        expect(subject?.kind === "tab" ? subject.tab.id : undefined).toBe("t1");
        // the drag carries Dockable's type, so the layouts claim its events
        expect(dataTransfer.types).toContain(DRAG_TYPE);
        expect(tab).toHaveAttribute("data-dragging", "");
        expect(path("/layout")).toHaveAttribute("data-dragging", "");
        expect(path("/ts0/tb0")).not.toHaveAttribute("data-dragging");

        act(() => {
            tab.dispatchEvent(dragEvent("dragend", 10, 10, dataTransfer));
        });
        expect(DragDropManager.getDragState()).toBeUndefined();
        expect(tab).not.toHaveAttribute("data-dragging");
        expect(path("/layout")).not.toHaveAttribute("data-dragging");
    });

    it("cancels the dragstart of a tab that cannot be dragged", () => {
        const model = freshModel({
            version: 1,
            defaults: { tab: { enableDrag: false } },
            root: {
                type: "row",
                children: [
                    {
                        type: "tabset",
                        children: [{ component: "test", data: { name: "A" } }],
                    },
                ],
            },
        });
        render(<Layout model={model} />);
        const event = dragEvent("dragstart", 0, 0);
        path("/ts0/tb0").dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
        expect(DragDropManager.getDragState()).toBeUndefined();
    });
});

describe("Dockable.DropIndicator", () => {
    function DragFrom({ tabId }: { tabId: string }) {
        const { engine } = useDockable<Types>();
        return (
            <button
                type="button"
                data-testid="start"
                onClick={() =>
                    engine.adapter
                        .getDragDropManager()
                        .startDrag(dragEvent("dragstart", 0, 0), tabId)
                }
            />
        );
    }

    it("is hidden outside a drag and follows the computed drop rect during one", () => {
        const model = freshModel();
        render(
            <Layout model={model}>
                <Dockable.DropIndicator data-testid="indicator" />
                <DragFrom tabId="t2" />
            </Layout>,
        );
        const indicator = screen.getByTestId("indicator");
        expect(indicator).toHaveAttribute("data-layout-path", "/outline");
        expect(indicator).toHaveAttribute("aria-hidden", "true");
        expect(indicator.style.display).toBe("none");
        expect(indicator).not.toHaveAttribute("data-drop-location");

        act(() => {
            screen.getByTestId("start").click();
        });
        const root = path("/layout");
        act(() => {
            root.dispatchEvent(dragEvent("dragenter", 50, 50));
        });
        expect(indicator).toHaveAttribute("data-dragging", "");
        expect(indicator.style.display).toBe("none"); // 1x1 at the pointer, not yet over a target

        act(() => {
            root.dispatchEvent(dragEvent("dragover", 50, 50));
        });
        expect(indicator).toHaveAttribute("data-visible", "");
        expect(indicator.getAttribute("data-drop-location")).toMatch(
            /^(center|top|bottom|left|right)$/,
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

        act(() => {
            root.dispatchEvent(dragEvent("drop", 50, 50));
        });
        expect(indicator.style.display).toBe("none");
        expect(indicator).not.toHaveAttribute("data-dragging");
    });

    it("ignores drag events that do not carry Dockable's type", () => {
        const model = freshModel();
        render(
            <Layout model={model}>
                <Dockable.DropIndicator data-testid="indicator" />
                <DragFrom tabId="t2" />
            </Layout>,
        );
        act(() => {
            screen.getByTestId("start").click();
        });
        const root = path("/layout");
        const foreign = fakeDataTransfer(["text/plain"]);
        act(() => {
            root.dispatchEvent(dragEvent("dragenter", 50, 50, foreign));
            root.dispatchEvent(dragEvent("dragover", 50, 50, foreign));
        });
        const indicator = screen.getByTestId("indicator");
        expect(indicator).not.toHaveAttribute("data-visible");
        expect(indicator.style.display).toBe("none");
    });

    it("supports render and children", () => {
        const model = freshModel();
        render(
            <Layout model={model}>
                <Dockable.DropIndicator
                    render={<section data-testid="indicator" />}
                >
                    <span data-testid="inside" />
                </Dockable.DropIndicator>
            </Layout>,
        );
        expect(screen.getByTestId("indicator").tagName).toBe("SECTION");
        expect(screen.getByTestId("inside")).toBeInTheDocument();
    });

    it("renders no text of its own", () => {
        const model = freshModel();
        render(
            <Dockable.Root model={model}>
                <Dockable.DropIndicator data-testid="indicator" />
            </Dockable.Root>,
        );
        expect(screen.getByTestId("indicator").textContent).toBe("");
        expect(React.isValidElement(<Dockable.DropIndicator />)).toBe(true);
    });
});

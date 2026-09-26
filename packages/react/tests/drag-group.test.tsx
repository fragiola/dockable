import {
    type Action,
    Actions,
    DockLocation,
    DragDropManager,
    type IJsonModel,
    type ITransfer,
    LayoutEngine,
    Model,
    type TabNode,
} from "@fragiola/dockable";
import { act, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Dockable, useDragGroup } from "../src";
import { Layout, mounts } from "./layout";

// jsdom measures every element as 100x100 at (0, 0) (tests/setup.ts): a drop at (50, 50) lands in
// the first tabset of the layout it is dispatched on.

function dragEvent(type: string) {
    const event = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: 50,
        clientY: 50,
    });
    Object.defineProperty(event, "dataTransfer", {
        value: {
            types: [],
            setData: vi.fn(),
            setDragImage: vi.fn(),
            effectAllowed: "none",
            dropEffect: "none",
        },
    });
    return event as unknown as DragEvent;
}

const layoutJson = (prefix: string): IJsonModel => ({
    global: {},
    layout: {
        type: "row",
        children: [
            {
                type: "tabset",
                children: [
                    { type: "tab", id: `${prefix}0`, name: `${prefix}0` },
                    { type: "tab", id: `${prefix}1`, name: `${prefix}1` },
                ],
            },
        ],
    },
});

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
    if (DragDropManager.getDragState()) {
        act(() => {
            DragDropManager.getDragState()
                ?.mainEngine.getDragDropManager()
                .onDragEnded();
        });
    }
    mounts.clear();
});

/** drags `tabId` of `from` onto the root with test id `targetRoot` */
function dragTo(from: Model, tabId: string, targetRoot: string) {
    act(() => {
        LayoutEngine.of(from)
            ?.getDragDropManager()
            .setDragNode(
                dragEvent("dragstart"),
                from.getNodeById(tabId) as TabNode,
            );
    });
    const root = screen.getByTestId(targetRoot);
    act(() => {
        root.dispatchEvent(dragEvent("dragenter"));
        root.dispatchEvent(dragEvent("dragover"));
        root.dispatchEvent(dragEvent("drop"));
    });
}

function TwoLayouts({
    a,
    b,
    onTransfer,
    onActionB,
    grouped = true,
}: {
    a: Model;
    b: Model;
    onTransfer?: (transfer: ITransfer) => void;
    onActionB?: (action: Action) => Action | undefined;
    grouped?: boolean;
}) {
    const layouts = (
        <>
            <Layout model={a} data-testid="root-a" />
            <Layout model={b} data-testid="root-b" onAction={onActionB} />
        </>
    );
    return grouped ? (
        <Dockable.DragGroup onTransfer={onTransfer}>
            {layouts}
        </Dockable.DragGroup>
    ) : (
        layouts
    );
}

describe("Dockable.DragGroup", () => {
    it("moves a tab to another layout and keeps its content mounted, with its state", async () => {
        const a = Model.fromJson(layoutJson("a"));
        const b = Model.fromJson(layoutJson("b"));
        const onTransfer = vi.fn();
        render(<TwoLayouts a={a} b={b} onTransfer={onTransfer} />);
        await act(tick);
        fireEvent.click(screen.getByTestId("inc-a0"));
        fireEvent.change(screen.getByTestId("input-a0"), {
            target: { value: "kept" },
        });
        const content = screen.getByTestId("content-a0");
        expect(screen.getByTestId("root-a")).toContainElement(content);

        dragTo(a, "a0", "root-b");
        await act(tick);

        expect(a.getNodeById("a0")).toBeUndefined();
        expect(b.getNodeById("a0")).toBeDefined();
        const moved = screen.getByTestId("content-a0");
        expect(moved).toBe(content);
        expect(screen.getByTestId("root-b")).toContainElement(moved);
        expect(screen.getByTestId("inc-a0")).toHaveTextContent("count 1");
        expect(screen.getByTestId("input-a0")).toHaveValue("kept");
        expect(mounts.get("a0")).toBe(1);
        expect(onTransfer).toHaveBeenCalledWith(
            expect.objectContaining({
                from: expect.objectContaining({ model: a }),
                to: expect.objectContaining({ model: b }),
            }),
        );
    });

    it("refuses the drag between layouts that are not in one group", async () => {
        const a = Model.fromJson(layoutJson("a"));
        const b = Model.fromJson(layoutJson("b"));
        render(<TwoLayouts a={a} b={b} grouped={false} />);
        await act(tick);
        dragTo(a, "a0", "root-b");
        expect(a.getNodeById("a0")).toBeDefined();
        expect(b.getNodeById("a0")).toBeUndefined();
    });

    it("lets the target layout's onAction veto the transfer", async () => {
        const a = Model.fromJson(layoutJson("a"));
        const b = Model.fromJson(layoutJson("b"));
        render(
            <TwoLayouts
                a={a}
                b={b}
                onActionB={(action) =>
                    action.type === Actions.ADD_TAB ? undefined : action
                }
            />,
        );
        await act(tick);
        dragTo(a, "a0", "root-b");
        expect(a.getNodeById("a0")).toBeDefined();
        expect(b.getNodeById("a0")).toBeUndefined();
    });

    it("gives code the group: a transfer back from code keeps the content too", async () => {
        const a = Model.fromJson(layoutJson("a"));
        const b = Model.fromJson(layoutJson("b"));
        let group: ReturnType<typeof useDragGroup> | undefined;
        function Grab() {
            group = useDragGroup();
            return null;
        }
        render(
            <Dockable.DragGroup>
                <Grab />
                <Layout model={a} data-testid="root-a" />
                <Layout model={b} data-testid="root-b" />
            </Dockable.DragGroup>,
        );
        await act(tick);
        act(() => {
            a.doAction(Actions.selectTab("a1")); // render on demand: mount it
        });
        await act(tick);
        fireEvent.click(screen.getByTestId("inc-a1"));
        const content = screen.getByTestId("content-a1");
        const tabset = b.getFirstTabSet()?.getId() ?? "";
        act(() => {
            group?.transfer("a1", a, b, tabset, DockLocation.CENTER, -1);
        });
        await act(tick);
        act(() => {
            group?.transfer(
                "a1",
                b,
                a,
                a.getFirstTabSet()?.getId() ?? "",
                DockLocation.CENTER,
                1,
            );
        });
        await act(tick);
        expect(screen.getByTestId("content-a1")).toBe(content);
        expect(screen.getByTestId("root-a")).toContainElement(content);
        expect(screen.getByTestId("inc-a1")).toHaveTextContent("count 1");
        expect(mounts.get("a1")).toBe(1);
    });

    it("renders the content of same-id tabs of two models, each in its own layout", async () => {
        const a = Model.fromJson(layoutJson("x"));
        const b = Model.fromJson(layoutJson("x"));
        render(<TwoLayouts a={a} b={b} />);
        await act(tick);
        const contents = screen.getAllByTestId("content-x0");
        expect(contents).toHaveLength(2);
        expect(screen.getByTestId("root-a")).toContainElement(
            contents[0] ?? null,
        );
        expect(screen.getByTestId("root-b")).toContainElement(
            contents[1] ?? null,
        );
    });

    it("an unmounted layout leaves the group", async () => {
        const a = Model.fromJson(layoutJson("a"));
        const b = Model.fromJson(layoutJson("b"));
        let group: ReturnType<typeof useDragGroup> | undefined;
        function Grab() {
            group = useDragGroup();
            return null;
        }
        function App({ showB }: { showB: boolean }) {
            return (
                <Dockable.DragGroup>
                    <Grab />
                    <Layout model={a} data-testid="root-a" />
                    {showB ? <Layout model={b} data-testid="root-b" /> : null}
                </Dockable.DragGroup>
            );
        }
        const { rerender } = render(<App showB />);
        await act(tick);
        expect(group?.engineOf(b)).toBeDefined();

        rerender(<App showB={false} />);
        await act(tick);
        expect(group?.engineOf(b)).toBeUndefined();
        const tabset = b.getFirstTabSet()?.getId() ?? "";
        expect(
            group?.transfer("a0", a, b, tabset, DockLocation.CENTER, -1),
        ).toBeUndefined();
        expect(a.getNodeById("a0")).toBeDefined();
    });

    it("still renders content without a group, and removes a closed tab's content", async () => {
        const a = Model.fromJson(layoutJson("a"));
        render(
            <Dockable.DragGroup>
                <Layout model={a} data-testid="root-a" />
            </Dockable.DragGroup>,
        );
        await act(tick);
        expect(screen.getByTestId("content-a0")).toBeInTheDocument();
        act(() => {
            a.doAction(Actions.deleteTab("a0"));
        });
        await act(tick);
        expect(screen.queryByTestId("content-a0")).toBeNull();
    });
});

// useDragGroup outside a group is a programming error
describe("useDragGroup", () => {
    it("throws outside Dockable.DragGroup", () => {
        function Bad() {
            useDragGroup();
            return null;
        }
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});
        expect(() => render(<Bad />)).toThrow(/Dockable.DragGroup/);
        spy.mockRestore();
    });
});
void React;

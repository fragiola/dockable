import {
    createModel,
    DRAG_TYPE,
    DragDropManager,
    type LayoutJson,
    type Model,
    type Transfer,
    veto,
} from "@fragiola/dockable";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Dockable, useDragGroup } from "../src";
import { Layout, mounts, recordCommands, type Types } from "./layout";

// jsdom measures every element as 100x100 at (0, 0) (tests/setup.ts): a drop at (50, 50) lands in
// the first tabset of the layout it is dispatched on.

/** jsdom has no DragEvent: a MouseEvent with a fake dataTransfer carrying the Dockable drag type */
function dragEvent(type: string) {
    const event = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: 50,
        clientY: 50,
    });
    const types = [DRAG_TYPE];
    Object.defineProperty(event, "dataTransfer", {
        value: {
            types,
            setData: vi.fn((kind: string) => {
                if (!types.includes(kind)) types.push(kind);
            }),
            getData: vi.fn(() => ""),
            setDragImage: vi.fn(),
            effectAllowed: "none",
            dropEffect: "none",
            files: [],
        },
    });
    return event;
}

const layoutJson = (prefix: string): LayoutJson<Types> => ({
    version: 1,
    root: {
        type: "row",
        id: "row",
        children: [
            {
                type: "tabset",
                id: "ts0",
                children: [
                    {
                        id: `${prefix}0`,
                        component: "test",
                        data: { name: `${prefix}0` },
                    },
                    {
                        id: `${prefix}1`,
                        component: "test",
                        data: { name: `${prefix}1` },
                    },
                ],
            },
        ],
    },
});

const modelOf = (prefix: string) =>
    createModel<Types>(structuredClone(layoutJson(prefix)));

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
    if (DragDropManager.getDragState()) {
        act(() => {
            DragDropManager.getDragState()
                ?.mainEngine.adapter.getDragDropManager()
                .onDragEnded();
        });
    }
    mounts.clear();
});

/** drags the tab named `tabName` of the root `fromRoot` onto the root `targetRoot` */
function dragTo(fromRoot: string, tabName: string, targetRoot: string) {
    const tab = within(screen.getByTestId(fromRoot)).getByRole("tab", {
        name: tabName,
    });
    act(() => {
        tab.dispatchEvent(dragEvent("dragstart"));
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
    grouped = true,
}: {
    a: Model<Types>;
    b: Model<Types>;
    onTransfer?: (transfer: Transfer) => void;
    grouped?: boolean;
}) {
    const layouts = (
        <>
            <Layout model={a} data-testid="root-a" />
            <Layout model={b} data-testid="root-b" />
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
        const a = modelOf("a");
        const b = modelOf("b");
        const commandsA = recordCommands(a);
        const commandsB = recordCommands(b);
        const onTransfer = vi.fn();
        render(<TwoLayouts a={a} b={b} onTransfer={onTransfer} />);
        await act(tick);
        fireEvent.click(screen.getByTestId("inc-a0"));
        fireEvent.change(screen.getByTestId("input-a0"), {
            target: { value: "kept" },
        });
        const content = screen.getByTestId("content-a0");
        expect(screen.getByTestId("root-a")).toContainElement(content);

        dragTo("root-a", "a0", "root-b");
        await act(tick);

        expect(a.get("node-by", { id: "a0" })).toBeUndefined();
        expect(b.get("node-by", { id: "a0" })).toBeDefined();
        const moved = screen.getByTestId("content-a0");
        expect(moved).toBe(content);
        expect(screen.getByTestId("root-b")).toContainElement(moved);
        expect(screen.getByTestId("inc-a0")).toHaveTextContent("count 1");
        expect(screen.getByTestId("input-a0")).toHaveValue("kept");
        expect(mounts.get("a0")).toBe(1);
        // a transfer is a tab.add in the target and a tab.close in the source
        expect(commandsB.map((c) => c.command)).toContain("tab.add");
        expect(commandsA).toContainEqual(
            expect.objectContaining({
                command: "tab.close",
                payload: { tabId: "a0" },
            }),
        );
        expect(onTransfer).toHaveBeenCalledWith(
            expect.objectContaining({
                tab: "a0",
                previousId: "a0",
                from: expect.objectContaining({ model: a }),
                to: expect.objectContaining({ model: b }),
            }),
        );
    });

    it("refuses the drag between layouts that are not in one group", async () => {
        const a = modelOf("a");
        const b = modelOf("b");
        render(<TwoLayouts a={a} b={b} grouped={false} />);
        await act(tick);
        dragTo("root-a", "a0", "root-b");
        expect(a.get("node-by", { id: "a0" })).toBeDefined();
        expect(b.get("node-by", { id: "a0" })).toBeUndefined();
    });

    it("lets the target model's middleware veto the transfer", async () => {
        const a = modelOf("a");
        const b = modelOf("b");
        const transfers: unknown[] = [];
        b.use((ctx, next) => {
            if (ctx.command === "tab.add" && ctx.meta?.transfer) {
                transfers.push(ctx.meta.transfer);
                return veto();
            }
            return next();
        });
        render(<TwoLayouts a={a} b={b} />);
        await act(tick);
        dragTo("root-a", "a0", "root-b");
        expect(transfers.length).toBeGreaterThan(0);
        expect(transfers[0]).toEqual({ tabId: "a0", from: a, to: b });
        expect(a.get("node-by", { id: "a0" })).toBeDefined();
        expect(b.get("node-by", { id: "a0" })).toBeUndefined();
    });

    it("gives code the group: a transfer back from code keeps the content too", async () => {
        const a = modelOf("a");
        const b = modelOf("b");
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
            a.run("tab.select", { tabId: "a1" }); // render on demand: mount it
        });
        await act(tick);
        fireEvent.click(screen.getByTestId("inc-a1"));
        const content = screen.getByTestId("content-a1");
        let moved: string | undefined;
        act(() => {
            moved = group?.transfer({
                tab: "a1",
                from: a,
                to: b,
                target: "ts0",
                location: "center",
                index: -1,
            });
        });
        expect(moved).toBe("a1");
        await act(tick);
        act(() => {
            group?.transfer({
                tab: "a1",
                from: b,
                to: a,
                target: "ts0",
                location: "center",
                index: 1,
            });
        });
        await act(tick);
        expect(screen.getByTestId("content-a1")).toBe(content);
        expect(screen.getByTestId("root-a")).toContainElement(content);
        expect(screen.getByTestId("inc-a1")).toHaveTextContent("count 1");
        expect(mounts.get("a1")).toBe(1);
    });

    it("renders the content of same-id tabs of two models, each in its own layout", async () => {
        const a = modelOf("x");
        const b = modelOf("x");
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
        const a = modelOf("a");
        const b = modelOf("b");
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
        expect(
            group?.transfer({
                tab: "a0",
                from: a,
                to: b,
                target: "ts0",
                location: "center",
                index: -1,
            }),
        ).toBeUndefined();
        expect(a.get("node-by", { id: "a0" })).toBeDefined();
    });

    it("still renders content without a group, and removes a closed tab's content", async () => {
        const a = modelOf("a");
        render(
            <Dockable.DragGroup>
                <Layout model={a} data-testid="root-a" />
            </Dockable.DragGroup>,
        );
        await act(tick);
        expect(screen.getByTestId("content-a0")).toBeInTheDocument();
        act(() => {
            a.run("tab.close", { tabId: "a0" });
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

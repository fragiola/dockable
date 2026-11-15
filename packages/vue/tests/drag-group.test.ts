import {
    createModel,
    DragDropManager,
    type LayoutJson,
    type Model,
    type Transfer,
    veto,
} from "@fragiola/dockable";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, shallowRef } from "vue";
import { useDragGroup } from "../src";
import { byTestId, dragEvent } from "./drag";
import {
    Dockable,
    Layout,
    mounts,
    recordCommands,
    render,
    settle,
    type Types,
} from "./layout";

// jsdom measures every element as 100x100 at (0, 0) (tests/setup.ts): a drop at (50, 50) lands in
// the first tabset of the layout it is dispatched on.

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
                        label: `${prefix}0`,
                        data: { name: `${prefix}0` },
                    },
                    {
                        id: `${prefix}1`,
                        component: "test",
                        label: `${prefix}1`,
                        data: { name: `${prefix}1` },
                    },
                ],
            },
        ],
    },
});

const modelOf = (prefix: string) =>
    createModel<Types>(structuredClone(layoutJson(prefix)));

afterEach(() => {
    if (DragDropManager.getDragState()) {
        DragDropManager.endDrag();
    }
    mounts.clear();
});

/** the tab button named `name` inside the root `root` */
function tabNamed(root: string, name: string): HTMLElement {
    const tab = Array.from(
        byTestId(root).querySelectorAll<HTMLElement>('[role="tab"]'),
    ).find((element) => element.textContent === name);
    if (!tab) throw new Error(`no tab ${name} in ${root}`);
    return tab;
}

/** drags the tab named `tabName` of the root `fromRoot` onto the root `targetRoot` */
async function dragTo(fromRoot: string, tabName: string, targetRoot: string) {
    tabNamed(fromRoot, tabName).dispatchEvent(dragEvent("dragstart"));
    await nextTick();
    const root = byTestId(targetRoot);
    root.dispatchEvent(dragEvent("dragenter"));
    root.dispatchEvent(dragEvent("dragover"));
    root.dispatchEvent(dragEvent("drop"));
    await settle();
}

function twoLayouts(
    a: Model<Types>,
    b: Model<Types>,
    options: {
        onTransfer?: (transfer: Transfer) => void;
        grouped?: boolean;
    } = {},
) {
    const layouts = () => [
        h(Layout, { model: a, "data-testid": "root-a" }),
        h(Layout, { model: b, "data-testid": "root-b" }),
    ];
    return render(
        defineComponent({
            setup: () => () =>
                options.grouped === false
                    ? layouts()
                    : h(
                          Dockable.DragGroup,
                          { onTransfer: options.onTransfer },
                          { default: layouts },
                      ),
        }),
    );
}

/** a component that hands the enclosing drag group out */
function grabber(onGroup: (group: ReturnType<typeof useDragGroup>) => void) {
    return defineComponent({
        name: "GroupGrab",
        setup() {
            onGroup(useDragGroup());
            return () => null;
        },
    });
}

describe("Dockable.DragGroup", () => {
    it("moves a tab to another layout and keeps its content mounted, with its state", async () => {
        const a = modelOf("a");
        const b = modelOf("b");
        const commandsA = recordCommands(a);
        const commandsB = recordCommands(b);
        const onTransfer = vi.fn();
        await twoLayouts(a, b, { onTransfer });
        byTestId("inc-a0").click();
        const input = byTestId("input-a0") as HTMLInputElement;
        input.value = "kept";
        await nextTick();
        const content = byTestId("content-a0");
        expect(byTestId("root-a")).toContainElement(content);

        await dragTo("root-a", "a0", "root-b");

        expect(a.get("node-by", { id: "a0" })).toBeUndefined();
        expect(b.get("node-by", { id: "a0" })).toBeDefined();
        const moved = byTestId("content-a0");
        expect(moved).toBe(content);
        expect(byTestId("root-b")).toContainElement(moved);
        expect(byTestId("inc-a0")).toHaveTextContent("count 1");
        expect(byTestId("input-a0")).toHaveValue("kept");
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
                tabId: "a0",
                previousId: "a0",
                from: expect.objectContaining({ model: a }),
                to: expect.objectContaining({ model: b }),
            }),
        );
    });

    it("refuses the drag between layouts that are not in one group", async () => {
        const a = modelOf("a");
        const b = modelOf("b");
        await twoLayouts(a, b, { grouped: false });
        await dragTo("root-a", "a0", "root-b");
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
        await twoLayouts(a, b);
        await dragTo("root-a", "a0", "root-b");
        expect(transfers.length).toBeGreaterThan(0);
        expect(transfers[0]).toEqual({ tabId: "a0", from: a, to: b });
        expect(a.get("node-by", { id: "a0" })).toBeDefined();
        expect(b.get("node-by", { id: "a0" })).toBeUndefined();
    });

    it("gives code the group: a transfer back from code keeps the content too", async () => {
        const a = modelOf("a");
        const b = modelOf("b");
        let group: ReturnType<typeof useDragGroup> | undefined;
        const Grab = grabber((value) => {
            group = value;
        });
        await render(
            defineComponent({
                setup: () => () =>
                    h(Dockable.DragGroup, null, {
                        default: () => [
                            h(Grab),
                            h(Layout, { model: a, "data-testid": "root-a" }),
                            h(Layout, { model: b, "data-testid": "root-b" }),
                        ],
                    }),
            }),
        );
        a.run("tab.select", { tabId: "a1" }); // render on demand: mount it
        await settle();
        byTestId("inc-a1").click();
        await nextTick();
        const content = byTestId("content-a1");
        const moved = group?.transfer({
            tabId: "a1",
            from: a,
            to: b,
            target: "ts0",
            location: "center",
            index: -1,
        });
        expect(moved).toBe("a1");
        await settle();
        group?.transfer({
            tabId: "a1",
            from: b,
            to: a,
            target: "ts0",
            location: "center",
            index: 1,
        });
        await settle();
        expect(byTestId("content-a1")).toBe(content);
        expect(byTestId("root-a")).toContainElement(content);
        expect(byTestId("inc-a1")).toHaveTextContent("count 1");
        expect(mounts.get("a1")).toBe(1);
    });

    it("renders the content of same-id tabs of two models, each in its own layout", async () => {
        const a = modelOf("x");
        const b = modelOf("x");
        await twoLayouts(a, b);
        const contents = Array.from(
            document.querySelectorAll('[data-testid="content-x0"]'),
        );
        expect(contents).toHaveLength(2);
        expect(byTestId("root-a")).toContainElement(
            (contents[0] as HTMLElement | undefined) ?? null,
        );
        expect(byTestId("root-b")).toContainElement(
            (contents[1] as HTMLElement | undefined) ?? null,
        );
    });

    it("an unmounted layout leaves the group", async () => {
        const a = modelOf("a");
        const b = modelOf("b");
        let group: ReturnType<typeof useDragGroup> | undefined;
        const Grab = grabber((value) => {
            group = value;
        });
        const showB = shallowRef(true);
        await render(
            defineComponent({
                setup: () => () =>
                    h(Dockable.DragGroup, null, {
                        default: () => [
                            h(Grab),
                            h(Layout, { model: a, "data-testid": "root-a" }),
                            showB.value
                                ? h(Layout, {
                                      model: b,
                                      "data-testid": "root-b",
                                  })
                                : null,
                        ],
                    }),
            }),
        );
        expect(group?.engineOf(b)).toBeDefined();

        showB.value = false;
        await settle();
        expect(group?.engineOf(b)).toBeUndefined();
        expect(
            group?.transfer({
                tabId: "a0",
                from: a,
                to: b,
                target: "ts0",
                location: "center",
                index: -1,
            }),
        ).toBeUndefined();
        expect(a.get("node-by", { id: "a0" })).toBeDefined();
    });

    it("still renders content with one layout, and removes a closed tab's content", async () => {
        const a = modelOf("a");
        await render(
            defineComponent({
                setup: () => () =>
                    h(Dockable.DragGroup, null, {
                        default: () => [
                            h(Layout, { model: a, "data-testid": "root-a" }),
                        ],
                    }),
            }),
        );
        expect(byTestId("content-a0")).toBeInTheDocument();
        a.run("tab.close", { tabId: "a0" });
        await settle();
        expect(document.querySelector('[data-testid="content-a0"]')).toBeNull();
    });
});

// useDragGroup outside a group is a programming error
describe("useDragGroup", () => {
    it("throws outside Dockable.DragGroup", async () => {
        const Bad = defineComponent({
            name: "BadGroup",
            setup() {
                useDragGroup();
                return () => null;
            },
        });
        const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
        await expect(render(Bad)).rejects.toThrow(/Dockable.DragGroup/);
        spy.mockRestore();
    });
});

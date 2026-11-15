import { createModel, type LayoutJson, type TabOf } from "@fragiola/dockable";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref } from "vue";
import { useDockable, useModelState } from "../src";
import {
    Dockable,
    Layout,
    render,
    renderNode,
    settle,
    type Types,
    twoTabsets,
} from "./layout";

function freshModel(json: LayoutJson<Types> = twoTabsets) {
    return createModel<Types>(structuredClone(json));
}

const testId = (id: string) => {
    const found = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
    if (!found) throw new Error(`no element ${id}`);
    return found;
};

/** the fixture layout for `model`, with `child` in it */
function inLayout(model: ReturnType<typeof freshModel>, child: () => unknown) {
    return defineComponent({
        setup: () => () => h(Layout, { model }, { default: () => [child()] }),
    });
}

describe("useModelState", () => {
    it("triggers its readers only when its selection changes", async () => {
        const model = freshModel();
        const renders: number[] = [];
        const TabCount = defineComponent({
            name: "TabCount",
            setup() {
                const count = useModelState<Types, number>(
                    (_state, m) => m.get("all-tabs").length,
                );
                return () => {
                    renders.push(count.value);
                    return h("output", { "data-testid": "count" }, count.value);
                };
            },
        });
        await render(inLayout(model, () => h(TabCount)));
        const before = renders.length;
        expect(testId("count")).toHaveTextContent("3");

        // a change that leaves the count alone: the selection is equal, so no render
        model.run("tab.select", { tabId: "t1" });
        await settle();
        expect(renders.length).toBe(before);
        const afterSelect = renders.length;

        model.run("tab.close", { tabId: "t2" });
        await settle();
        expect(testId("count")).toHaveTextContent("2");
        expect(renders.length).toBeGreaterThan(afterSelect);
    });

    it("keeps the previous selection when isEqual says it did not change", async () => {
        const model = freshModel();
        let names: { value: string[] } | undefined;
        const Names = defineComponent({
            name: "TabNames",
            setup() {
                names = useModelState<Types, string[]>(
                    (_state, m) => m.get("all-tabs").map((tab) => tab.label),
                    { isEqual: (a, b) => a.join() === b.join() },
                );
                return () => null;
            },
        });
        await render(inLayout(model, () => h(Names)));
        const first = names?.value;
        model.run("tab.select", { tabId: "t1" }); // a new state, the same names
        await settle();
        expect(names?.value).toBe(first);
        model.run("tab.rename", { tabId: "t0", label: "Uno" });
        await settle();
        expect(names?.value).toEqual(["Uno", "Two", "Three"]);
    });
});

describe("useModelState, selectors and contexts", () => {
    it("reads a given model outside Dockable.Root, triggering only when its answer changes", async () => {
        const model = freshModel();
        const renders: number[] = [];
        const TabCount = defineComponent({
            name: "OutsideCount",
            setup() {
                const count = useModelState(
                    (_state, m) => m.get("all-tabs").length,
                    { model },
                );
                return () => {
                    renders.push(count.value);
                    return h(
                        "output",
                        { "data-testid": "outside" },
                        count.value,
                    );
                };
            },
        });
        await render(TabCount);
        expect(testId("outside")).toHaveTextContent("3");
        expect(renders).toEqual([3]);
        model.run("tab.select", { tabId: "t1" });
        await settle();
        expect(renders).toEqual([3]);
        model.run("tab.close", { tabId: "t2" });
        await settle();
        expect(testId("outside")).toHaveTextContent("2");
        expect(renders).toEqual([3, 2]);
    });

    it("needs a Dockable.Root or a model", () => {
        const Orphan = defineComponent({
            name: "OrphanState",
            setup() {
                useModelState((_state, m) => m.get("all-tabs").length);
                return () => null;
            },
        });
        vi.spyOn(console, "warn").mockImplementation(() => {});
        expect(() => mount(Orphan)).toThrow(/Dockable.Root/);
        vi.restoreAllMocks();
    });

    it("reads another model when its model option changes", async () => {
        const first = freshModel();
        const second = freshModel();
        second.run("tab.close", { tabId: "t2" });
        const current = ref(first);
        const Count = defineComponent({
            name: "SwitchedCount",
            setup() {
                const count = useModelState(
                    (_state, m) => m.get("all-tabs").length,
                    { model: () => current.value },
                );
                return () =>
                    h("output", { "data-testid": "switched" }, count.value);
            },
        });
        await render(Count);
        expect(testId("switched")).toHaveTextContent("3");
        current.value = second;
        await settle();
        expect(testId("switched")).toHaveTextContent("2");
    });

    it("works in the tab content of a drag group's layout", async () => {
        const model = freshModel();
        const Count = defineComponent({
            name: "GroupedCount",
            setup() {
                const count = useModelState<Types, number>(
                    (_state, m) => m.get("all-tabs").length,
                );
                return () =>
                    h(
                        "output",
                        { "data-testid": "grouped-count" },
                        count.value,
                    );
            },
        });
        await render(
            defineComponent({
                setup: () => () =>
                    h(Dockable.DragGroup, null, {
                        default: () => [
                            h(
                                Dockable.Root,
                                { model },
                                {
                                    default: () => [
                                        h(Dockable.Row, null, {
                                            default: ({
                                                node,
                                            }: {
                                                node: Parameters<
                                                    typeof renderNode
                                                >[0];
                                            }) => [renderNode(node)],
                                        }),
                                        h(Dockable.Panels, null, {
                                            default: ({
                                                tab,
                                            }: {
                                                tab: TabOf<Types>;
                                            }) => [
                                                h(
                                                    Dockable.Panel,
                                                    { node: tab },
                                                    {
                                                        default: () =>
                                                            tab.id === "t0"
                                                                ? [h(Count)]
                                                                : [],
                                                    },
                                                ),
                                            ],
                                        }),
                                    ],
                                },
                            ),
                        ],
                    }),
            }),
        );
        expect(testId("grouped-count")).toHaveTextContent("3");
    });
});

describe("layout.load", () => {
    it("keeps the content of the tabs it keeps mounted, with their state", async () => {
        const model = freshModel();
        await render(Layout, { model });
        const input = testId("input-t0") as HTMLInputElement;
        input.value = "typed";

        // the same tabs, arranged differently: t0 moves into the second tabset
        const next: LayoutJson<Types> = {
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
                                id: "t1",
                                component: "test",
                                label: "Two",
                                data: { name: "Two" },
                            },
                        ],
                    },
                    {
                        type: "tabset",
                        id: "ts1",
                        children: [
                            {
                                id: "t2",
                                component: "test",
                                label: "Three",
                                data: { name: "Three" },
                            },
                            {
                                id: "t0",
                                component: "test",
                                label: "One",
                                data: { name: "One" },
                            },
                        ],
                        selected: 1,
                    },
                ],
            },
        };
        expect(model.run("layout.load", { layout: next }).ok).toBe(true);
        await settle();
        expect(testId("input-t0")).toBe(input);
        expect(input.value).toBe("typed");
        const tab = [
            ...document.querySelectorAll<HTMLElement>('[role="tab"]'),
        ].find((element) => element.textContent === "One");
        const panel = document.getElementById(
            tab?.getAttribute("aria-controls") ?? "",
        );
        expect(panel).toHaveAttribute("data-layout-path", "/ts1/t1");
        expect(panel?.contains(input)).toBe(true);
    });
});

describe("useDockable", () => {
    it("gives the typed model, the engine and the layout id", async () => {
        const model = freshModel();
        let result: ReturnType<typeof useDockable<Types>> | undefined;
        const Probe = defineComponent({
            name: "DockableProbe",
            setup() {
                result = useDockable<Types>();
                return () => null;
            },
        });
        await render(inLayout(model, () => h(Probe)));
        expect(result?.model).toBe(model);
        expect(result?.layoutId).toBe("main");
        expect(result && Object.keys(result).sort()).toEqual([
            "engine",
            "layoutId",
            "model",
        ]);
        expect(result?.engine.is("main-layout")).toBe(true);
        result?.model.run("tab.select", { tabId: "t1" });
        await settle();
        expect(model.get("selected-tab-by", { tabsetId: "ts0" })?.id).toBe(
            "t1",
        );
    });
});

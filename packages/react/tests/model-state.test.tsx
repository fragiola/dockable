import { createModel, type LayoutJson } from "@fragiola/dockable";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Dockable, useDockable, useModelState } from "../src";
import { Layout, renderNode, type Types, twoTabsets } from "./layout";

function freshModel(json: LayoutJson<Types> = twoTabsets) {
    return createModel<Types>(structuredClone(json));
}

describe("useModelState", () => {
    it("re-renders only when its selection changes", async () => {
        const model = freshModel();
        const renders: number[] = [];
        function TabCount() {
            const count = useModelState<Types, number>(
                (_state, m) => m.get("all-tabs").length,
            );
            renders.push(count);
            return <output data-testid="count">{count}</output>;
        }
        render(
            <Layout model={model}>
                <TabCount />
            </Layout>,
        );
        await act(async () => {});
        const before = renders.length;
        expect(screen.getByTestId("count")).toHaveTextContent("3");

        // a change that leaves the count alone: the selection is equal, so no re-render (the
        // root re-renders the layout, but this element is the same `children` it was given)
        await act(async () => {
            model.run("tab.select", { tabId: "t1" });
        });
        expect(renders.length).toBe(before);
        const afterSelect = renders.length;

        await act(async () => {
            model.run("tab.close", { tabId: "t2" });
        });
        expect(screen.getByTestId("count")).toHaveTextContent("2");
        expect(renders.length).toBeGreaterThan(afterSelect);
    });

    it("keeps the previous selection when isEqual says it did not change", async () => {
        const model = freshModel();
        const seen: string[][] = [];
        function Names() {
            const names = useModelState<Types, string[]>(
                (_state, m) => m.get("all-tabs").map((tab) => tab.data.name),
                (a, b) => a.join() === b.join(),
            );
            seen.push(names);
            return null;
        }
        render(
            <Layout model={model}>
                <Names />
            </Layout>,
        );
        await act(async () => {});
        const first = seen.at(-1);
        await act(async () => {
            model.run("tab.select", { tabId: "t1" }); // a new state, the same names
        });
        expect(seen.at(-1)).toBe(first);
        await act(async () => {
            model.run("tab.update", {
                tabId: "t0",
                component: "test",
                data: { name: "Uno" },
            });
        });
        expect(seen.at(-1)).toEqual(["Uno", "Two", "Three"]);
    });
});

describe("useModelState, selectors and contexts", () => {
    it("selects again when the selector changes, with no commit", async () => {
        const model = freshModel();
        function Name({ id }: { id: string }) {
            const name = useModelState<Types, string | undefined>(
                (_state, m) => {
                    const tab = m.get("node-by-id", { nodeId: id });
                    return tab?.type === "tab" ? tab.data.name : undefined;
                },
            );
            return <output data-testid="name">{name}</output>;
        }
        const { rerender } = render(
            <Layout model={model}>
                <Name id="t0" />
            </Layout>,
        );
        await act(async () => {});
        expect(screen.getByTestId("name")).toHaveTextContent("One");
        rerender(
            <Layout model={model}>
                <Name id="t2" />
            </Layout>,
        );
        expect(screen.getByTestId("name")).toHaveTextContent("Three");
    });

    it("works in the tab content of a drag group's layout", async () => {
        const model = freshModel();
        function Count() {
            const count = useModelState<Types, number>(
                (_state, m) => m.get("all-tabs").length,
            );
            return <output data-testid="grouped-count">{count}</output>;
        }
        render(
            <Dockable.DragGroup>
                <Dockable.Root model={model}>
                    <Dockable.Row<Types>>{renderNode}</Dockable.Row>
                    <Dockable.Panels<Types>>
                        {(tab) => (
                            <Dockable.Panel node={tab}>
                                {tab.id === "t0" ? <Count /> : null}
                            </Dockable.Panel>
                        )}
                    </Dockable.Panels>
                </Dockable.Root>
            </Dockable.DragGroup>,
        );
        await act(async () => {});
        expect(screen.getByTestId("grouped-count")).toHaveTextContent("3");
    });
});

describe("layout.load", () => {
    it("keeps the content of the tabs it keeps mounted, with their state", async () => {
        const model = freshModel();
        render(<Layout model={model} />);
        await act(async () => {});
        const input = screen.getByTestId("input-t0");
        fireEvent.change(input, { target: { value: "typed" } });

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
                                data: { name: "Three" },
                            },
                            {
                                id: "t0",
                                component: "test",
                                data: { name: "One" },
                            },
                        ],
                        selected: 1,
                    },
                ],
            },
        };
        await act(async () => {
            expect(model.run("layout.load", { layout: next }).ok).toBe(true);
        });
        expect(screen.getByTestId("input-t0")).toBe(input);
        expect(input).toHaveValue("typed");
        const panel = document.getElementById(
            screen
                .getAllByRole("tab")
                .find((tab) => tab.textContent === "One")
                ?.getAttribute("aria-controls") ?? "",
        );
        expect(panel).toHaveAttribute("data-layout-path", "/ts1/t1");
        expect(panel?.contains(input)).toBe(true);
    });
});

describe("useDockable", () => {
    it("gives the typed model, its run, the engines and the layout id", async () => {
        const model = freshModel();
        let result: ReturnType<typeof useDockable<Types>> | undefined;
        function Probe() {
            result = useDockable<Types>();
            return null;
        }
        render(
            <Layout model={model}>
                <Probe />
            </Layout>,
        );
        await act(async () => {});
        expect(result?.model).toBe(model);
        expect(result?.layoutId).toBe("main");
        expect(result && Object.keys(result).sort()).toEqual([
            "engine",
            "layoutId",
            "model",
        ]);
        expect(result?.engine.is("main-layout")).toBe(true);
        await act(async () => {
            result?.model.run("tab.select", { tabId: "t1" });
        });
        expect(
            model.get("selected-tab-by-tabset-id", { tabsetId: "ts0" })?.id,
        ).toBe("t1");
    });
});

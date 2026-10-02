import {
    createModel,
    type LayoutJson,
    type Model,
    type TabJson,
    type TabsetNode,
} from "@fragiola/dockable";
import { act, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { Dockable, type TabOverflowTriggerState, useTabOverflow } from "../src";
import { recordCommands, type Types } from "./layout";

// jsdom measures a tab list as 100px and a tab as 30px (tests/setup.ts): 3 of 4 tabs fit
const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                id: "ts0",
                children: ["a", "b", "c", "d"].map(
                    (id): TabJson<Types> => ({
                        id,
                        component: "test",
                        label: id.toUpperCase(),
                        data: { name: id.toUpperCase() },
                    }),
                ),
            },
        ],
    },
};

const load = (): Model<Types> => createModel<Types>(structuredClone(json));

function Menu({ tabset }: { tabset: TabsetNode<Types> }) {
    const { hiddenTabs } = useTabOverflow(tabset);
    return (
        <ul data-testid="menu">
            {hiddenTabs.map((tab) => (
                <li key={tab.id}>{tab.label}</li>
            ))}
        </ul>
    );
}

function OverflowLayout({
    model,
    trigger,
}: {
    model: Model<Types>;
    trigger?: (tabset: TabsetNode<Types>) => React.ReactNode;
}) {
    return (
        <Dockable.Root model={model}>
            <Dockable.Row<Types>>
                {(tabset) =>
                    tabset.type === "tabset" ? (
                        <Dockable.TabSet node={tabset}>
                            <Dockable.TabList<Types>>
                                {(tab) => (
                                    <Dockable.Tab node={tab}>
                                        {tab.label}
                                    </Dockable.Tab>
                                )}
                            </Dockable.TabList>
                            {trigger ? (
                                trigger(tabset)
                            ) : (
                                <Dockable.TabOverflowTrigger data-testid="trigger">
                                    <span>more</span>
                                </Dockable.TabOverflowTrigger>
                            )}
                            <Menu tabset={tabset} />
                            <Dockable.TabSetContent />
                        </Dockable.TabSet>
                    ) : null
                }
            </Dockable.Row>
        </Dockable.Root>
    );
}

/** A tabset with a bare tab list and a trigger, for the variants below. */
function BareLayout({
    model,
    overflow,
    label,
}: {
    model: Model<Types>;
    overflow?: boolean;
    label?: string;
}) {
    return (
        <Dockable.Root model={model}>
            <Dockable.Row<Types>>
                {(tabset) =>
                    tabset.type === "tabset" ? (
                        <Dockable.TabSet node={tabset}>
                            <Dockable.TabList<Types> overflow={overflow}>
                                {(tab) => <Dockable.Tab node={tab} />}
                            </Dockable.TabList>
                            <Dockable.TabOverflowTrigger
                                data-testid="trigger"
                                aria-label={label}
                            />
                        </Dockable.TabSet>
                    ) : null
                }
            </Dockable.Row>
        </Dockable.Root>
    );
}

const path = (value: string) =>
    document.querySelector<HTMLElement>(`[data-layout-path="${value}"]`);

const element = (value: string): HTMLElement => {
    const found = path(value);
    if (!found) {
        throw new Error(`no element at ${value}`);
    }
    return found;
};

describe("tab overflow", () => {
    it("hides the tabs that do not fit, and shows the trigger with the hidden ones", () => {
        render(<OverflowLayout model={load()} />);
        expect(path("/ts0/tabstrip")).toHaveAttribute("data-overflowing", "");
        const hiddenTab = element("/ts0/tb3");
        expect(hiddenTab).toHaveAttribute("data-overflow-hidden", "");
        expect(hiddenTab.style.display).toBe("none");
        const visibleTab = element("/ts0/tb0");
        expect(visibleTab).not.toHaveAttribute("data-overflow-hidden");
        expect(visibleTab.style.display).toBe("");
        const trigger = screen.getByTestId("trigger");
        expect(trigger).toHaveAttribute(
            "data-layout-path",
            "/ts0/button/overflow",
        );
        expect(trigger).toHaveAttribute("data-count", "1");
        expect(trigger).toHaveAttribute("type", "button");
        expect(screen.getByTestId("menu")).toHaveTextContent("D");
    });

    it("brings a tab selected from the menu into the strip, hiding another in its place", () => {
        const model = load();
        render(<OverflowLayout model={model} />);
        act(() => {
            model.run("tab.select", { tabId: "d" });
        });
        expect(path("/ts0/tb3")).not.toHaveAttribute("data-overflow-hidden");
        expect(path("/ts0/tb2")).toHaveAttribute("data-overflow-hidden", "");
        expect(screen.getByTestId("menu")).toHaveTextContent("C");
    });

    it("selects a hidden tab reached with the arrow keys, which brings it into the strip", () => {
        const model = load();
        const commands = recordCommands(model);
        render(<OverflowLayout model={model} />);
        const tab2 = element("/ts0/tb2");
        tab2.focus();
        fireEvent.keyDown(tab2, { key: "ArrowRight" });
        expect(commands.at(-1)).toEqual({
            command: "tab.select",
            payload: { tabId: "d" },
            transient: false,
        });
        expect(path("/ts0/tb3")).not.toHaveAttribute("data-overflow-hidden");
    });

    it("switches tabs at the overflow boundary under StrictMode without an update loop (caplin/FlexLayout#498)", () => {
        const error = vi.spyOn(console, "error");
        const model = load();
        let commits = 0;
        render(
            <React.StrictMode>
                <React.Profiler id="layout" onRender={() => commits++}>
                    <OverflowLayout model={model} />
                </React.Profiler>
            </React.StrictMode>,
        );
        // every switch moves a tab across the boundary (3 of 4 fit), back and forth
        for (const id of ["d", "a", "c", "d", "b", "d", "a"]) {
            const before = commits;
            act(() => {
                model.run("tab.select", { tabId: id });
            });
            expect(
                commits - before,
                `commits selecting ${id}`,
            ).toBeLessThanOrEqual(4);
            expect(path(`/ts0/tb${"abcd".indexOf(id)}`)).not.toHaveAttribute(
                "data-overflow-hidden",
            );
        }
        expect(error).not.toHaveBeenCalled();
        error.mockRestore();
    });

    it("renders no trigger, and no data-overflowing, when every tab fits", () => {
        const model = load();
        render(<OverflowLayout model={model} />);
        act(() => {
            model.run("tab.close", { tabId: "d" });
        });
        expect(path("/ts0/tabstrip")).not.toHaveAttribute("data-overflowing");
        expect(screen.queryByTestId("trigger")).toBeNull();
        expect(path("/ts0/tb2")).not.toHaveAttribute("data-overflow-hidden");
    });
});

describe("TabList overflow={false}", () => {
    it("keeps every tab, for a strip that wraps or scrolls", () => {
        render(<BareLayout model={load()} overflow={false} />);
        expect(path("/ts0/tabstrip")).not.toHaveAttribute("data-overflowing");
        expect(path("/ts0/tb3")).not.toHaveAttribute("data-overflow-hidden");
        expect(screen.queryByTestId("trigger")).toBeNull();
    });
});

describe("Dockable.TabOverflowTrigger follows the primitive contract", () => {
    it("takes render (element or function), a merged ref, props, className and style functions", () => {
        const ref = React.createRef<HTMLElement>();
        const onClick = vi.fn();
        let seen: TabOverflowTriggerState | undefined;
        render(
            <OverflowLayout
                model={load()}
                trigger={() => (
                    <Dockable.TabOverflowTrigger
                        ref={ref}
                        data-testid="trigger"
                        aria-haspopup="menu"
                        onClick={onClick}
                        className={(state) =>
                            `more more-${state.hiddenTabs.length}`
                        }
                        style={(state) => ({
                            opacity: state.hiddenTabs.length > 0 ? 1 : 0,
                            display: "block",
                        })}
                        render={(props, state) => {
                            seen = state;
                            return <span {...props} />;
                        }}
                    />
                )}
            />,
        );
        const trigger = screen.getByTestId("trigger");
        expect(trigger.tagName).toBe("SPAN");
        expect(ref.current).toBe(trigger);
        expect(trigger).toHaveClass("more", "more-1");
        expect(trigger).toHaveAttribute("aria-haspopup", "menu");
        expect(trigger.style.opacity).toBe("1");
        expect(seen?.hiddenTabs.map((tab) => tab.id)).toEqual(["d"]);
        fireEvent.click(trigger);
        expect(onClick).toHaveBeenCalled();
    });

    it("merges an element render prop and renders no text of its own", () => {
        render(
            <OverflowLayout
                model={load()}
                trigger={() => (
                    <Dockable.TabOverflowTrigger
                        data-testid="trigger"
                        render={<a href="#more" />}
                    />
                )}
            />,
        );
        const trigger = screen.getByTestId("trigger");
        expect(trigger.tagName).toBe("A");
        expect(trigger).toHaveAttribute("data-count", "1");
        expect(trigger.textContent).toBe("");
    });

    it("has no name of its own, and takes the consumer's aria-label", () => {
        const { unmount } = render(<BareLayout model={load()} />);
        expect(screen.getByTestId("trigger")).not.toHaveAttribute("aria-label");
        unmount();

        render(<BareLayout model={load()} label="More tabs" />);
        expect(screen.getByTestId("trigger")).toHaveAccessibleName("More tabs");
    });
});

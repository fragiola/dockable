import {
    type Action,
    Actions,
    type IJsonModel,
    Model,
    type TabSetNode,
} from "@fragiola/dockable";
import { act, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { Dockable, type TabOverflowTriggerState, useTabOverflow } from "../src";

// jsdom measures a tab list as 100px and a tab as 30px (tests/setup.ts): 3 of 4 tabs fit
const json: IJsonModel = {
    global: {},
    layout: {
        type: "row",
        children: [
            {
                type: "tabset",
                id: "ts0",
                children: ["a", "b", "c", "d"].map((id) => ({
                    type: "tab" as const,
                    id,
                    name: id.toUpperCase(),
                })),
            },
        ],
    },
};

function Menu({ tabset }: { tabset: TabSetNode }) {
    const { hidden } = useTabOverflow(tabset);
    return (
        <ul data-testid="menu">
            {hidden.map((tab) => (
                <li key={tab.getId()}>{tab.getName()}</li>
            ))}
        </ul>
    );
}

function OverflowLayout({
    model,
    trigger,
    onAction,
}: {
    model: Model;
    trigger?: (tabset: TabSetNode) => React.ReactNode;
    onAction?: (action: Action) => Action | undefined;
}) {
    return (
        <Dockable.Root model={model} onAction={onAction}>
            <Dockable.Row>
                {(child) => {
                    const tabset = child as TabSetNode;
                    return (
                        <Dockable.TabSet node={tabset}>
                            <Dockable.TabList>
                                {(tab) => (
                                    <Dockable.Tab node={tab}>
                                        {tab.getName()}
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
                    );
                }}
            </Dockable.Row>
        </Dockable.Root>
    );
}

const path = (value: string) =>
    document.querySelector<HTMLElement>(`[data-layout-path="${value}"]`);

describe("tab overflow", () => {
    it("hides the tabs that do not fit, and shows the trigger with the hidden ones", () => {
        render(<OverflowLayout model={Model.fromJson(json)} />);
        expect(path("/ts0/tabstrip")).toHaveAttribute("data-overflowing", "");
        const hiddenTab = path("/ts0/tb3") as HTMLElement;
        expect(hiddenTab).toHaveAttribute("data-overflow-hidden", "");
        expect(hiddenTab.style.display).toBe("none");
        const visibleTab = path("/ts0/tb0") as HTMLElement;
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
        const model = Model.fromJson(json);
        const onAction = vi.fn((action: Action) => action);
        render(<OverflowLayout model={model} onAction={onAction} />);
        act(() => {
            model.doAction(Actions.selectTab("d"));
        });
        expect(path("/ts0/tb3")).not.toHaveAttribute("data-overflow-hidden");
        expect(path("/ts0/tb2")).toHaveAttribute("data-overflow-hidden", "");
        expect(screen.getByTestId("menu")).toHaveTextContent("C");
    });

    it("selects a hidden tab reached with the arrow keys, which brings it into the strip", () => {
        const onAction = vi.fn((action: Action) => action);
        render(
            <OverflowLayout model={Model.fromJson(json)} onAction={onAction} />,
        );
        const tab2 = path("/ts0/tb2") as HTMLElement;
        tab2.focus();
        fireEvent.keyDown(tab2, { key: "ArrowRight" });
        expect(onAction).toHaveBeenLastCalledWith(
            expect.objectContaining({
                type: Actions.SELECT_TAB,
                data: expect.objectContaining({ tabNode: "d" }),
            }),
        );
        expect(path("/ts0/tb3")).not.toHaveAttribute("data-overflow-hidden");
    });

    it("renders no trigger, and no data-overflowing, when every tab fits", () => {
        const model = Model.fromJson(json);
        render(<OverflowLayout model={model} />);
        act(() => {
            model.doAction(Actions.deleteTab("d"));
        });
        expect(path("/ts0/tabstrip")).not.toHaveAttribute("data-overflowing");
        expect(screen.queryByTestId("trigger")).toBeNull();
        expect(path("/ts0/tb2")).not.toHaveAttribute("data-overflow-hidden");
    });
});

describe("TabList overflow={false}", () => {
    it("keeps every tab, for a strip that wraps or scrolls", () => {
        render(
            <Dockable.Root model={Model.fromJson(json)}>
                <Dockable.Row>
                    {(child) => (
                        <Dockable.TabSet node={child as TabSetNode}>
                            <Dockable.TabList overflow={false}>
                                {(tab) => <Dockable.Tab node={tab} />}
                            </Dockable.TabList>
                            <Dockable.TabOverflowTrigger data-testid="trigger" />
                        </Dockable.TabSet>
                    )}
                </Dockable.Row>
            </Dockable.Root>,
        );
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
                model={Model.fromJson(json)}
                trigger={() => (
                    <Dockable.TabOverflowTrigger
                        ref={ref}
                        data-testid="trigger"
                        aria-haspopup="menu"
                        onClick={onClick}
                        className={(state) => `more more-${state.hiddenCount}`}
                        style={(state) => ({
                            opacity: state.hiddenCount > 0 ? 1 : 0,
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
        expect(seen?.hidden.map((tab) => tab.getId())).toEqual(["d"]);
        fireEvent.click(trigger);
        expect(onClick).toHaveBeenCalled();
    });

    it("merges an element render prop and renders no text of its own", () => {
        render(
            <OverflowLayout
                model={Model.fromJson(json)}
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

    it("names itself through getLabel", () => {
        render(
            <Dockable.Root
                model={Model.fromJson(json)}
                getLabel={(key) => `label:${key}`}
            >
                <Dockable.Row>
                    {(child) => (
                        <Dockable.TabSet node={child as TabSetNode}>
                            <Dockable.TabList>
                                {(tab) => <Dockable.Tab node={tab} />}
                            </Dockable.TabList>
                            <Dockable.TabOverflowTrigger data-testid="trigger" />
                        </Dockable.TabSet>
                    )}
                </Dockable.Row>
            </Dockable.Root>,
        );
        expect(screen.getByTestId("trigger")).toHaveAttribute(
            "aria-label",
            "label:dockable.overflow.menu.tooltip",
        );
    });
});

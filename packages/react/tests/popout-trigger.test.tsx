import {
    type Action,
    Actions,
    DockableLabel,
    type IJsonModel,
    Model,
} from "@fragiola/dockable";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Dockable } from "../src";

const json: IJsonModel = {
    global: { tabEnablePopout: true },
    layout: {
        type: "row",
        children: [
            {
                type: "tabset",
                id: "ts0",
                children: [
                    { type: "tab", id: "a", name: "A" },
                    { type: "tab", id: "b", name: "B", enablePopout: false },
                ],
            },
        ],
    },
};

function Layout({
    model,
    supportsPopout = true,
    onAction,
    target,
}: {
    model: Model;
    supportsPopout?: boolean;
    onAction?: (action: Action) => Action | undefined;
    target?: "tab" | "tabset";
}) {
    return (
        <Dockable.Root
            model={model}
            supportsPopout={supportsPopout}
            onAction={onAction}
            getLabel={(key) =>
                key === DockableLabel.Popout_Tab ? "Pop out" : undefined
            }
        >
            <Dockable.Row>
                {(child) =>
                    child.getType() === "tabset" ? (
                        <Dockable.TabSet node={child as never}>
                            <Dockable.TabList>
                                {(tab) => <Dockable.Tab node={tab} />}
                            </Dockable.TabList>
                            <Dockable.PopoutTrigger
                                target={target}
                                data-testid="trigger"
                            >
                                ↗
                            </Dockable.PopoutTrigger>
                            <Dockable.TabSetContent />
                        </Dockable.TabSet>
                    ) : null
                }
            </Dockable.Row>
        </Dockable.Root>
    );
}

describe("Dockable.PopoutTrigger", () => {
    it("is a button that pops the selected tab out, through onAction", () => {
        const model = Model.fromJson(json);
        const onAction = vi.fn(() => undefined); // veto: no window in jsdom
        render(<Layout model={model} onAction={onAction} />);
        const trigger = screen.getByTestId("trigger");
        expect(trigger.tagName).toBe("BUTTON");
        expect(trigger).toHaveAttribute("type", "button");
        expect(trigger).toHaveAttribute("data-mode", "popout");
        expect(trigger).toHaveAttribute("data-target", "tab");
        expect(trigger).toHaveAttribute(
            "data-layout-path",
            "/ts0/button/popout",
        );
        expect(trigger).toHaveAccessibleName("Pop out");
        expect(trigger.textContent).toBe("↗");
        fireEvent.click(trigger);
        expect(onAction).toHaveBeenCalledWith(
            expect.objectContaining({
                type: Actions.POPOUT_TAB,
                data: { node: "a", type: "window" },
            }),
        );
    });

    it("renders nothing when the selected tab cannot pop out, or popouts are unsupported", () => {
        const model = Model.fromJson(json);
        model.doAction(Actions.selectTab("b"));
        const { unmount } = render(<Layout model={model} />);
        expect(screen.queryByTestId("trigger")).toBeNull();
        unmount();

        render(<Layout model={Model.fromJson(json)} supportsPopout={false} />);
        expect(screen.queryByTestId("trigger")).toBeNull();
    });

    it("targets the whole tabset with target=tabset, only when every tab may pop out", () => {
        const model = Model.fromJson(json);
        const { unmount } = render(<Layout model={model} target="tabset" />);
        expect(screen.queryByTestId("trigger")).toBeNull(); // "B" refuses
        unmount();

        model.doAction(
            Actions.updateNodeAttributes("b", { enablePopout: true }),
        );
        const onAction = vi.fn(() => undefined);
        render(<Layout model={model} target="tabset" onAction={onAction} />);
        fireEvent.click(screen.getByTestId("trigger"));
        expect(onAction).toHaveBeenCalledWith(
            expect.objectContaining({ type: Actions.POPOUT_TABSET }),
        );
    });
});

import {
    createModel,
    DockableLabel,
    type LayoutJson,
    type Model,
    veto,
} from "@fragiola/dockable";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Dockable } from "../src";
import { recordCommands, type Types } from "./layout";

const json: LayoutJson<Types> = {
    version: 1,
    defaults: { tab: { enablePopout: true } },
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                id: "ts0",
                children: [
                    { id: "a", component: "test", data: { name: "A" } },
                    {
                        id: "b",
                        component: "test",
                        data: { name: "B" },
                        enablePopout: false,
                    },
                ],
            },
        ],
    },
};

const load = (): Model<Types> => createModel<Types>(structuredClone(json));

/** Records the popouts the model runs, and vetoes them: there is no window in jsdom. */
function vetoPopouts(model: Model<Types>) {
    const commands = recordCommands(model);
    model.use((ctx, next) =>
        !ctx.dryRun &&
        (ctx.command === "tab.popout" || ctx.command === "tabset.popout")
            ? veto("no window in jsdom")
            : next(),
    );
    return commands;
}

function Layout({
    model,
    supportsPopout = true,
    target,
}: {
    model: Model<Types>;
    supportsPopout?: boolean;
    target?: "tab" | "tabset";
}) {
    return (
        <Dockable.Root
            model={model}
            supportsPopout={supportsPopout}
            getLabel={(key) =>
                key === DockableLabel.Popout_Tab ? "Pop out" : undefined
            }
        >
            <Dockable.Row<Types>>
                {(child) =>
                    child.type === "tabset" ? (
                        <Dockable.TabSet node={child}>
                            <Dockable.TabList<Types>>
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
    it("is a button that pops the selected tab out, through the model's commands", () => {
        const model = load();
        const commands = vetoPopouts(model);
        render(<Layout model={model} />);
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
        expect(commands).toContainEqual({
            command: "tab.popout",
            payload: expect.objectContaining({ tab: "a" }),
            transient: false,
        });
        expect(model.state.windows).toHaveLength(0); // vetoed
    });

    it("renders nothing when the selected tab cannot pop out, or popouts are unsupported", () => {
        const model = load();
        model.run("tab.select", { tab: "b" });
        const { unmount } = render(<Layout model={model} />);
        expect(screen.queryByTestId("trigger")).toBeNull();
        unmount();

        render(<Layout model={load()} supportsPopout={false} />);
        expect(screen.queryByTestId("trigger")).toBeNull();
    });

    it("targets the whole tabset with target=tabset, only when every tab may pop out", () => {
        const model = load();
        const commands = vetoPopouts(model);
        const { unmount } = render(<Layout model={model} target="tabset" />);
        expect(screen.queryByTestId("trigger")).toBeNull(); // "B" refuses
        unmount();

        model.run("tab.configure", { tab: "b", enablePopout: true });
        render(<Layout model={model} target="tabset" />);
        const trigger = screen.getByTestId("trigger");
        expect(trigger).toHaveAttribute("data-target", "tabset");
        fireEvent.click(trigger);
        expect(commands).toContainEqual({
            command: "tabset.popout",
            payload: expect.objectContaining({ tabset: "ts0" }),
            transient: false,
        });
    });
});

import {
    type BorderNode,
    createModel,
    type LayoutJson,
    type Model,
    type RowNode,
    type TabOf,
    type TabsetNode,
    veto,
} from "@fragiola/dockable";
import { describe, expect, it } from "vitest";
import { defineComponent, h } from "vue";
import type { PopoutTriggerState } from "../src";
import { Dockable, recordCommands, render, settle, type Types } from "./layout";

const json: LayoutJson<Types> = {
    version: 1,
    defaults: { tab: { poppable: true } },
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                id: "ts0",
                children: [
                    {
                        id: "a",
                        component: "test",
                        label: "A",
                        data: { name: "A" },
                    },
                    {
                        id: "b",
                        component: "test",
                        label: "B",
                        data: { name: "B" },
                        poppable: false,
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

/** The trigger's name: a plain `aria-label` (default), from its state through `render`, or none. */
type Naming = "state" | "label" | "none";

function layout(options: {
    model: Model<Types>;
    supportsPopout?: boolean;
    target?: "tab" | "tabset";
    naming?: Naming;
}) {
    const { model, supportsPopout = true, target, naming = "label" } = options;
    const trigger = () =>
        h(
            Dockable.PopoutTrigger,
            {
                target,
                "data-testid": "trigger",
                "aria-label": naming === "label" ? "Pop out" : undefined,
            },
            {
                default: () => "↗",
                ...(naming === "state"
                    ? {
                          render: ({
                              props,
                              state,
                              children,
                          }: {
                              props: Record<string, unknown>;
                              state: PopoutTriggerState;
                              children: ReturnType<typeof h>;
                          }) => [
                              h(
                                  "button",
                                  {
                                      type: "button",
                                      ...props,
                                      "aria-label":
                                          state.mode === "dock"
                                              ? "Dock back"
                                              : "Pop out",
                                  },
                                  [children],
                              ),
                          ],
                      }
                    : {}),
            },
        );
    return defineComponent({
        setup: () => () =>
            h(
                Dockable.Root,
                { model, supportsPopout },
                {
                    default: () => [
                        h(Dockable.Row, null, {
                            default: ({
                                node: child,
                            }: {
                                node: TabsetNode<Types> | RowNode<Types>;
                            }) =>
                                child.type === "tabset"
                                    ? [
                                          h(
                                              Dockable.TabSet,
                                              { node: child },
                                              {
                                                  default: () => [
                                                      h(
                                                          Dockable.TabList,
                                                          null,
                                                          {
                                                              default: ({
                                                                  tab,
                                                              }: {
                                                                  tab: TabOf<Types>;
                                                              }) => [
                                                                  h(
                                                                      Dockable.Tab,
                                                                      {
                                                                          node: tab,
                                                                      },
                                                                  ),
                                                              ],
                                                          },
                                                      ),
                                                      trigger(),
                                                      h(Dockable.TabSetContent),
                                                  ],
                                              },
                                          ),
                                      ]
                                    : [],
                        }),
                    ],
                },
            ),
    });
}

const byTestId = (id: string) =>
    document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const testId = (id: string) => {
    const found = byTestId(id);
    if (!found) throw new Error(`no element ${id}`);
    return found;
};

async function click(target: HTMLElement) {
    target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
}

describe("Dockable.PopoutTrigger", () => {
    it("is a button that pops the selected tab out, through the model's commands", async () => {
        const model = load();
        const commands = vetoPopouts(model);
        await render(layout({ model }));
        const trigger = testId("trigger");
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
        await click(trigger);
        expect(commands).toContainEqual({
            command: "tab.popout",
            payload: expect.objectContaining({ tabId: "a" }),
            transient: false,
        });
        expect(model.state.windows).toHaveLength(0); // vetoed
    });

    it("has no name of its own", async () => {
        await render(layout({ model: load(), naming: "none" }));
        expect(testId("trigger")).not.toHaveAttribute("aria-label");
    });

    it("can be named from its state through the render slot, keeping its behaviour", async () => {
        const model = load();
        const commands = vetoPopouts(model);
        await render(layout({ model, naming: "state" }));
        const trigger = testId("trigger");
        expect(trigger).toHaveAttribute("data-mode", "popout");
        expect(trigger).toHaveAccessibleName("Pop out");
        expect(trigger.textContent).toBe("↗");
        await click(trigger);
        expect(commands).toContainEqual({
            command: "tab.popout",
            payload: expect.objectContaining({ tabId: "a" }),
            transient: false,
        });
    });

    it("renders nothing when the selected tab cannot pop out, or popouts are unsupported", async () => {
        const model = load();
        model.run("tab.select", { tabId: "b" });
        const first = await render(layout({ model }));
        expect(byTestId("trigger")).toBeNull();
        first.unmount();

        await render(layout({ model: load(), supportsPopout: false }));
        expect(byTestId("trigger")).toBeNull();
    });

    it("targets the whole tabset with target=tabset, only when every tab may pop out", async () => {
        const model = load();
        const commands = vetoPopouts(model);
        const first = await render(layout({ model, target: "tabset" }));
        expect(byTestId("trigger")).toBeNull(); // "B" refuses
        first.unmount();

        model.run("tab.configure", { tabId: "b", poppable: true });
        await render(layout({ model, target: "tabset" }));
        const trigger = testId("trigger");
        expect(trigger).toHaveAttribute("data-target", "tabset");
        await click(trigger);
        expect(commands).toContainEqual({
            command: "tabset.popout",
            payload: expect.objectContaining({ tabsetId: "ts0" }),
            transient: false,
        });
    });
});

const withBorder: LayoutJson<Types> = {
    ...structuredClone(json),
    borders: [
        {
            location: "bottom",
            selected: 0,
            children: [
                {
                    id: "terminal",
                    component: "test",
                    label: "Terminal",
                    data: { name: "Terminal" },
                },
            ],
        },
    ],
};

function borderLayout(model: Model<Types>, target?: "tab" | "tabset") {
    return defineComponent({
        setup: () => () =>
            h(
                Dockable.Root,
                { model, supportsPopout: true },
                {
                    default: () => [
                        h(Dockable.Borders, null, {
                            bar: ({
                                border,
                            }: {
                                border: BorderNode<Types>;
                            }) => [
                                h(
                                    Dockable.Border,
                                    { node: border },
                                    {
                                        default: () => [
                                            h(Dockable.TabList, null, {
                                                default: ({
                                                    tab,
                                                }: {
                                                    tab: TabOf<Types>;
                                                }) => [
                                                    h(Dockable.Tab, {
                                                        node: tab,
                                                    }),
                                                ],
                                            }),
                                            h(Dockable.PopoutTrigger, {
                                                target,
                                                "data-testid": "border-trigger",
                                                "aria-label": "Pop out",
                                            }),
                                        ],
                                    },
                                ),
                            ],
                            default: () => [
                                h(Dockable.Row, null, {
                                    default: ({
                                        node: child,
                                    }: {
                                        node:
                                            | TabsetNode<Types>
                                            | RowNode<Types>;
                                    }) =>
                                        child.type === "tabset"
                                            ? [
                                                  h(
                                                      Dockable.TabSet,
                                                      { node: child },
                                                      {
                                                          default: () => [
                                                              h(
                                                                  Dockable.TabSetContent,
                                                              ),
                                                          ],
                                                      },
                                                  ),
                                              ]
                                            : [],
                                }),
                            ],
                        }),
                    ],
                },
            ),
    });
}

describe("Dockable.PopoutTrigger in a border", () => {
    it("pops the border's selected tab out", async () => {
        const model = createModel<Types>(structuredClone(withBorder));
        const commands = vetoPopouts(model);
        await render(borderLayout(model));
        const trigger = testId("border-trigger");
        expect(trigger).toHaveAttribute("data-mode", "popout");
        expect(trigger).toHaveAttribute(
            "data-layout-path",
            "/border/bottom/button/popout",
        );
        await click(trigger);
        expect(commands).toContainEqual({
            command: "tab.popout",
            payload: expect.objectContaining({ tabId: "terminal" }),
            transient: false,
        });
    });

    it("renders nothing with target=tabset: a border is not a tabset", async () => {
        await render(
            borderLayout(
                createModel<Types>(structuredClone(withBorder)),
                "tabset",
            ),
        );
        expect(byTestId("border-trigger")).toBeNull();
    });
});

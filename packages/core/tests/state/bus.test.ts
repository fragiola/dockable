// The command bus (design record §6): results, middleware, dry runs, batches, events and
// re-entrancy.
import { describe, expect, it, vi } from "vitest";
import {
    type CommandEvent,
    type Middleware,
    veto,
} from "../../src/commands/types";
import { createModel } from "../../src/state/model";
import { must, render, tab, tabsets } from "./harness";

const model2 = () => createModel(tabsets(["One", "Two"], ["Three"]));

describe("results", () => {
    it("uses up no generated id in a dry run", () => {
        const model = model2();
        const to = model.get("tabsets")[0]?.id ?? "";
        const asked = model.check("tab.add", {
            component: "x",
            label: "x",
            to,
        });
        const added = model.run("tab.add", { component: "x", label: "x", to });
        expect(asked.ok && added.ok && asked.value.tabId).toBe(
            added.ok ? added.value.tabId : "",
        );
    });

    it("hands out frozen schemas from commands()", () => {
        const model = model2();
        const info = model.get("commands").find((c) => c.name === "tab.select");
        expect(Object.isFrozen(info?.payloadSchema)).toBe(true);
        expect(Object.isFrozen(info?.payloadSchema.required)).toBe(true);
    });

    it("runs through detached methods (`const { run } = model`)", () => {
        const model = model2();
        const { run, can, dispatch, subscribe, use } = model;
        const events: string[] = [];
        subscribe((event) => events.push(event.command));
        use((_ctx, next) => next());
        const tabId = model.get("all-tabs")[1]?.id ?? "";
        expect(can("tab.select", { tabId })).toBe(true);
        expect(run("tab.select", { tabId }).ok).toBe(true);
        expect(dispatch({ command: "tab.close", payload: { tabId } }).ok).toBe(
            true,
        );
        expect(events).toEqual(["tab.select", "tab.close"]);
    });

    it("never throws on bad input", () => {
        const model = model2();
        expect(model.run("tab.nope" as "tab.close", { tabId: "One" })).toEqual({
            ok: false,
            error: {
                code: "unknown_command",
                message: 'unknown command "tab.nope"',
            },
        });
        expect(model.run("tab.close", { tabId: 3 } as never)).toEqual({
            ok: false,
            error: {
                code: "invalid_payload",
                message: "must be a string",
                path: "/tabId",
                issues: [{ path: "/tabId", message: "must be a string" }],
            },
        });
        expect(
            model.run("tab.close", { tabId: "x", extra: 1 } as never),
        ).toMatchObject({
            ok: false,
            error: {
                code: "invalid_payload",
                path: "/extra",
                message: "is not allowed",
            },
        });
        expect(model.run("tab.close", { tabId: "missing" })).toEqual({
            ok: false,
            error: {
                code: "not_found",
                message: 'no tab "missing"',
                path: "/tabId",
            },
        });
        expect(model.run("tab.close", undefined as never)).toMatchObject({
            ok: false,
            error: { code: "invalid_payload" },
        });
    });

    it("dispatch hands the app's meta (never the input's) to middleware and listeners", () => {
        const model = model2();
        const seen: unknown[] = [];
        model.use((ctx, next) => {
            seen.push(ctx.meta);
            return ctx.meta?.source === "assistant" &&
                ctx.command === "tab.close"
                ? veto("assistants may not close tabs")
                : next();
        });
        const events: unknown[] = [];
        model.subscribe((event) => events.push(event.meta));
        const tabId = model.get("all-tabs")[0]?.id ?? "";
        const meta = { source: "assistant" };
        expect(
            model.dispatch(
                { command: "tab.close", payload: { tabId } },
                { meta },
            ),
        ).toMatchObject({ ok: false, error: { code: "vetoed" } });
        expect(
            model.dispatch(
                { command: "tab.select", payload: { tabId } },
                { meta },
            ).ok,
        ).toBe(true);
        expect(seen).toEqual([meta, meta]);
        expect(events).toEqual([meta]);
        // the input cannot carry it
        expect(
            model.dispatch({
                command: "tab.close",
                payload: { tabId },
                meta: { source: "app" },
            }),
        ).toMatchObject({ ok: false, error: { path: "/meta" } });
    });

    it("dispatch validates untrusted JSON and reports paths into it", () => {
        const model = model2();
        expect(model.dispatch("tab.close")).toMatchObject({
            ok: false,
            error: { code: "invalid_payload", path: "" },
        });
        expect(model.dispatch({ command: 1, payload: {} })).toMatchObject({
            ok: false,
            error: { code: "invalid_payload", path: "/command" },
        });
        expect(model.dispatch({ command: "nope", payload: {} })).toMatchObject({
            ok: false,
            error: { code: "unknown_command", path: "/command" },
        });
        expect(
            model.dispatch({ command: "tab.close", payload: [] }),
        ).toMatchObject({
            ok: false,
            error: { code: "invalid_payload", path: "/payload" },
        });
        expect(
            model.dispatch({ command: "tab.close", payload: {} }),
        ).toMatchObject({
            ok: false,
            error: {
                code: "invalid_payload",
                path: "/payload/tabId",
                message: "is required",
            },
        });
        expect(
            model.dispatch({
                command: "tab.close",
                payload: { tabId: "One" },
                x: 1,
            }),
        ).toMatchObject({
            ok: false,
            error: { code: "invalid_payload", path: "/x" },
        });
        expect(
            JSON.parse(
                JSON.stringify(
                    model.dispatch(
                        JSON.parse(
                            '{"command":"tab.select","payload":{"tabId":"Two"}}',
                        ),
                    ),
                ),
            ),
        ).toEqual({
            ok: true,
            value: { tabId: "Two" },
        });

        // a payload names its ids: the field is `tabId`, never `tab`
        expect(
            model.dispatch({ command: "tab.close", payload: { tab: "One" } }),
        ).toMatchObject({
            ok: false,
            error: { code: "invalid_payload", path: "/payload/tabId" },
        });
    });

    it("points a transient batch's refused step at its command, and dispatch at /transient", () => {
        const model = model2();
        expect(
            model.run(
                "batch",
                {
                    commands: [
                        { command: "tab.select", payload: { tabId: "Two" } },
                    ],
                },
                { transient: true },
            ),
        ).toMatchObject({
            ok: false,
            error: { code: "invalid_payload", path: "/commands/0/command" },
        });
        expect(
            model.dispatch({
                command: "tab.select",
                payload: { tabId: "Two" },
                transient: true,
            }),
        ).toMatchObject({ ok: false, error: { path: "/transient" } });
    });

    it("rejects a transient run of a command that is not transient-capable", () => {
        const model = model2();
        expect(
            model.run("tab.select", { tabId: "Two" }, { transient: true }),
        ).toMatchObject({
            ok: false,
            error: { code: "invalid_payload", path: "/transient" },
        });
        expect(
            model.run(
                "row.resize",
                { rowId: "root", weights: [1, 2] },
                { transient: true },
            ).ok,
        ).toBe(true);
    });
});

describe("middleware", () => {
    it("vetoes", () => {
        const model = model2();
        model.use((ctx, next) =>
            ctx.command === "tab.close" ? veto("closing is disabled") : next(),
        );
        expect(model.run("tab.close", { tabId: "One" })).toEqual({
            ok: false,
            error: { code: "vetoed", message: "closing is disabled" },
        });
        expect(model.get("node-by", { id: "One" })).toBeDefined();
    });

    it("rewrites the payload, which is validated again", () => {
        const model = model2();
        model.use((ctx, next) => {
            if (ctx.command === "tab.select") {
                ctx.payload = { tabId: "One" };
            }
            if (ctx.command === "tab.close") {
                ctx.payload = { tabId: 5 } as never;
            }
            return next();
        });
        must(model.run("tab.select", { tabId: "Two" }));
        expect(model.get("selected-tab-by", { tabsetId: "ts0" })?.id).toBe(
            "One",
        );
        expect(model.run("tab.close", { tabId: "One" })).toMatchObject({
            ok: false,
            error: { code: "invalid_payload", path: "/tabId" },
        });
    });

    it("observes after next, and passes on next's result when it returns nothing", () => {
        const model = model2();
        const seen: string[] = [];
        model.use((ctx, next) => {
            const result = next();
            seen.push(`${ctx.command}:${result.ok}`);
            return undefined;
        });
        expect(model.run("tab.select", { tabId: "Two" })).toEqual({
            ok: true,
            value: { tabId: "Two" },
        });
        expect(model.run("tab.close", { tabId: "missing" }).ok).toBe(false);
        expect(seen).toEqual(["tab.select:true", "tab.close:false"]);
    });

    it("runs the first added outermost, and removes", () => {
        const model = model2();
        const order: string[] = [];
        const remove = model.use((_, next) => {
            order.push("a");
            return next();
        });
        model.use((_, next) => {
            order.push("b");
            return next();
        });
        must(model.run("tab.select", { tabId: "Two" }));
        remove();
        must(model.run("tab.select", { tabId: "One" }));
        expect(order).toEqual(["a", "b", "b"]);
    });

    it("sees the commands of a batch, so a batch cannot bypass a veto", () => {
        const model = model2();
        const seen: string[] = [];
        model.use((ctx, next) => {
            seen.push(`${ctx.command}${ctx.inBatch ? " (in batch)" : ""}`);
            return ctx.command === "tab.close" ? veto() : next();
        });
        const result = model.run("batch", {
            commands: [
                { command: "tab.select", payload: { tabId: "Two" } },
                { command: "tab.close", payload: { tabId: "One" } },
            ],
        });
        expect(result).toMatchObject({ ok: false, error: { code: "vetoed" } });
        expect(seen).toEqual([
            "batch",
            "tab.select (in batch)",
            "tab.close (in batch)",
        ]);
        expect(model.get("selected-tab-by", { tabsetId: "ts0" })?.id).toBe(
            "One",
        );
    });

    it("reports a throw as middleware_error and commits nothing", () => {
        const model = model2();
        const before = model.state;
        model.use(() => {
            throw new Error("boom");
        });
        expect(model.run("tab.select", { tabId: "Two" })).toEqual({
            ok: false,
            error: { code: "middleware_error", message: "boom" },
        });
        expect(model.state).toBe(before);
    });

    it("sees the draft through ctx.get inside a batch", () => {
        const model = model2();
        let seen: unknown;
        model.use((ctx, next) => {
            if (ctx.command === "tab.select") {
                seen = ctx.get("node-by", { id: "n" })?.type;
            }
            return next();
        });
        must(
            model.run("batch", {
                commands: [
                    {
                        command: "tab.add",
                        payload: {
                            id: "n",
                            component: "x",
                            label: "x",
                            to: "ts0",
                        },
                    },
                    { command: "tab.select", payload: { tabId: "n" } },
                ],
            }),
        );
        expect(seen).toBe("tab");
    });

    it("reads a node's parent through ctx.get, as the batch left it", () => {
        const model = model2();
        let parent: string | undefined;
        model.use((ctx, next) => {
            if (ctx.command === "tab.select") {
                parent = ctx.get("node-parent-by", {
                    nodeId: ctx.payload.tabId,
                })?.id;
            }
            return next();
        });
        must(
            model.run("batch", {
                commands: [
                    {
                        command: "tab.move",
                        payload: { tabId: "One", to: "ts1" },
                    },
                    { command: "tab.select", payload: { tabId: "One" } },
                ],
            }),
        );
        expect(parent).toBe("ts1");
        expect(model.get("node-parent-by", { nodeId: "One" })?.id).toBe("ts1");
    });
});

describe("ctx.get", () => {
    it("reads nothing for an unknown key or a payload without a node id", () => {
        const model = model2();
        const seen: unknown[] = [];
        model.use((ctx, next) => {
            const get = ctx.get as (key: string, payload?: unknown) => unknown;
            seen.push(
                get("layout-id-by", { nodeId: "One" }),
                get("node-by"),
                get("One"),
            );
            return next();
        });
        must(model.run("tab.select", { tabId: "One" }));
        expect(seen).toEqual([undefined, undefined, undefined]);
    });
});

describe("dry run", () => {
    it("check and can commit nothing and emit nothing", () => {
        const model = model2();
        const listener = vi.fn();
        model.subscribe(listener);
        const before = model.state;
        expect(model.check("tab.close", { tabId: "One" })).toEqual({
            ok: true,
            value: { tabId: "One" },
        });
        expect(
            model.can("tab.move", { tabId: "One", to: "ts1", location: "top" }),
        ).toBe(true);
        expect(model.state).toBe(before);
        expect(listener).not.toHaveBeenCalled();
    });

    it("can answers a boolean, check says why", () => {
        const model = model2();
        expect(model.can("tab.close", { tabId: "One" })).toBe(true);
        expect(model.can("tab.close", { tabId: "nope" })).toBe(false);
        expect(model.check("tab.close", { tabId: "nope" })).toMatchObject({
            ok: false,
            error: { code: "not_found" },
        });
    });

    it("can and check are bound", () => {
        const model = model2();
        const { can, check } = model;
        expect(can("tab.close", { tabId: "One" })).toBe(true);
        expect(check("tab.close", { tabId: "One" }).ok).toBe(true);
    });

    it("check goes through the middleware with dryRun", () => {
        const model = model2();
        const flags: boolean[] = [];
        model.use((ctx, next) => {
            flags.push(ctx.dryRun);
            return ctx.command === "tab.move" ? veto() : next();
        });
        expect(
            model.check("tab.move", { tabId: "One", to: "ts1" }),
        ).toMatchObject({
            ok: false,
            error: { code: "vetoed" },
        });
        expect(model.can("tab.move", { tabId: "One", to: "ts1" })).toBe(false);
        expect(flags).toEqual([true, true]);
    });
});

describe("batch", () => {
    it("is atomic: a failing third command leaves the state unchanged and emits nothing", () => {
        const model = model2();
        const listener = vi.fn();
        model.subscribe(listener);
        const before = model.state;
        const result = model.run("batch", {
            commands: [
                { command: "tab.select", payload: { tabId: "Two" } },
                { command: "tab.move", payload: { tabId: "Three", to: "ts0" } },
                { command: "tab.close", payload: { tabId: "nope" } },
            ],
        });
        expect(result).toEqual({
            ok: false,
            error: {
                code: "not_found",
                message: 'no tab "nope"',
                path: "/commands/2/payload/tabId",
            },
        });
        expect(model.state).toBe(before);
        expect(listener).not.toHaveBeenCalled();
    });

    it("reports an unknown command's path", () => {
        const model = model2();
        expect(
            model.run("batch", {
                commands: [{ command: "x.y", payload: {} } as never],
            }),
        ).toMatchObject({
            ok: false,
            error: { code: "unknown_command", path: "/commands/0/command" },
        });
    });

    it("places a dispatched batch's step errors under /payload", () => {
        const model = model2();
        model.use((ctx, next) =>
            ctx.inBatch && ctx.command === "tab.close"
                ? {
                      ok: false,
                      error: { code: "refused", message: "no", path: "/tabId" },
                  }
                : next(),
        );
        const errorOf = (commands: unknown[], transient?: boolean) => {
            const result = model.dispatch({
                command: "batch",
                payload: { commands },
                ...(transient === undefined ? {} : { transient }),
            });
            return result.ok ? undefined : result.error;
        };
        expect(errorOf([{ command: "x.y", payload: {} }])).toMatchObject({
            code: "unknown_command",
            path: "/payload/commands/0/command",
        });
        expect(
            errorOf([{ command: "tab.select", payload: { tabId: 1 } }]),
        ).toMatchObject({
            code: "invalid_payload",
            path: "/payload/commands/0/payload/tabId",
            issues: [{ path: "/payload/commands/0/payload/tabId" }],
        });
        expect(
            errorOf([{ command: "tab.close", payload: { tabId: "One" } }]),
        ).toMatchObject({
            code: "refused",
            path: "/payload/commands/0/payload/tabId",
        });
        expect(
            errorOf([
                {
                    command: "batch",
                    payload: {
                        commands: [
                            { command: "tab.select", payload: { tabId: "x" } },
                        ],
                    },
                },
            ]),
        ).toMatchObject({
            code: "not_found",
            path: "/payload/commands/0/payload/commands/0/payload/tabId",
        });
        expect(
            errorOf(
                [{ command: "tab.select", payload: { tabId: "Two" } }],
                true,
            ),
        ).toMatchObject({
            code: "invalid_payload",
            path: "/payload/commands/0/command",
        });
    });

    it("points any unknown_command failure of a step at its command", () => {
        const model = model2();
        model.use((ctx, next) =>
            ctx.command === "tab.select"
                ? {
                      ok: false,
                      error: {
                          code: "unknown_command",
                          message: "gone",
                          path: "/tabId",
                      },
                  }
                : next(),
        );
        expect(
            model.run("batch", {
                commands: [
                    { command: "tab.select", payload: { tabId: "One" } },
                ],
            }),
        ).toEqual({
            ok: false,
            error: {
                code: "unknown_command",
                message: "gone",
                path: "/commands/0/command",
            },
        });
        expect(model.run("tab.select", { tabId: "One" })).toMatchObject({
            ok: false,
            error: { code: "unknown_command", path: "/tabId" },
        });
    });

    it("emits one event that lists its commands, flattened", () => {
        const model = model2();
        const events: CommandEvent[] = [];
        model.subscribe((event) => events.push(event));
        must(
            model.run("batch", {
                commands: [
                    { command: "tab.select", payload: { tabId: "Two" } },
                    {
                        command: "batch",
                        payload: {
                            commands: [
                                {
                                    command: "tab.close",
                                    payload: { tabId: "Three" },
                                },
                            ],
                        },
                    },
                ],
            }),
        );
        expect(events).toHaveLength(1);
        expect(events[0]?.commands).toEqual([
            {
                command: "tab.select",
                payload: { tabId: "Two" },
                result: { tabId: "Two" },
            },
            {
                command: "tab.close",
                payload: { tabId: "Three" },
                result: { tabId: "Three" },
            },
        ]);
    });
});

describe("events", () => {
    it("carries the command, payload, result, states and transient flag", () => {
        const model = model2();
        const events: CommandEvent[] = [];
        model.subscribe((event) => events.push(event));
        const before = model.state;
        must(
            model.run(
                "row.resize",
                { rowId: "root", weights: [1, 3] },
                { transient: true, meta: { from: "test" } },
            ),
        );
        expect(events[0]).toMatchObject({
            command: "row.resize",
            payload: { rowId: "root", weights: [1, 3] },
            result: { rowId: "root" },
            before,
            after: model.state,
            transient: true,
            meta: { from: "test" },
        });
    });

    it("emits exactly one event per run, dispatch or batch (caplin/FlexLayout#513)", () => {
        const model = model2();
        const listener = vi.fn();
        model.subscribe(listener);
        must(model.run("tab.select", { tabId: "Two" }));
        expect(listener).toHaveBeenCalledTimes(1);
        const dispatched = model.dispatch({
            command: "tab.select",
            payload: { tabId: "One" },
        });
        expect(dispatched.ok).toBe(true);
        expect(listener).toHaveBeenCalledTimes(2);
        must(
            model.run("batch", {
                commands: [
                    { command: "tab.select", payload: { tabId: "Two" } },
                    { command: "tab.close", payload: { tabId: "Three" } },
                ],
            }),
        );
        expect(listener).toHaveBeenCalledTimes(3);
        // a refused command commits nothing, and emits nothing
        expect(model.run("tab.select", { tabId: "missing" }).ok).toBe(false);
        expect(listener).toHaveBeenCalledTimes(3);
    });

    it("fires for a command that changed nothing, with before === after", () => {
        const model = model2();
        must(model.run("tab.select", { tabId: "One" }));
        const events: CommandEvent[] = [];
        model.subscribe((event) => events.push(event));
        must(model.run("tab.select", { tabId: "One" }));
        expect(events).toHaveLength(1);
        expect(events[0]?.before).toBe(events[0]?.after);
    });

    it("unsubscribes", () => {
        const model = model2();
        const listener = vi.fn();
        const unsubscribe = model.subscribe(listener);
        unsubscribe();
        must(model.run("tab.select", { tabId: "Two" }));
        expect(listener).not.toHaveBeenCalled();
    });

    it("keeps notifying after a listener throws, then rethrows", () => {
        const model = model2();
        const second = vi.fn();
        model.subscribe(() => {
            throw new Error("listener");
        });
        model.subscribe(second);
        expect(() => model.run("tab.select", { tabId: "Two" })).toThrowError(
            "listener",
        );
        expect(second).toHaveBeenCalledTimes(1);
        expect(model.get("selected-tab-by", { tabsetId: "ts0" })?.id).toBe(
            "Two",
        );
    });
});

describe("re-entrancy", () => {
    it("a run from a listener applies at once; its event follows the current one", () => {
        const model = model2();
        const order: string[] = [];
        model.subscribe((event) => {
            order.push(`a:${event.command}`);
            if (event.command === "tab.select") {
                const result = model.run("tabset.activate", {
                    tabsetId: "ts1",
                });
                order.push(`ran:${result.ok}`);
            }
        });
        model.subscribe((event) => order.push(`b:${event.command}`));
        must(model.run("tab.select", { tabId: "Two" }));
        expect(order).toEqual([
            "a:tab.select",
            "ran:true",
            "b:tab.select",
            "a:tabset.activate",
            "b:tabset.activate",
        ]);
        expect(model.get("active-tabset")?.id).toBe("ts1");
    });

    it("a run from a middleware is queued after the current command", () => {
        const model = model2();
        const commands: string[] = [];
        model.subscribe((event) => commands.push(event.command));
        let queued: unknown;
        const remove = model.use((ctx, next) => {
            if (ctx.command === "tab.select" && !ctx.dryRun) {
                queued = model.run("tabset.activate", { tabsetId: "ts1" });
            }
            return next();
        });
        must(model.run("tab.select", { tabId: "Two" }));
        remove();
        expect(queued).toMatchObject({ ok: false, error: { code: "queued" } });
        expect(commands).toEqual(["tab.select", "tabset.activate"]);
        expect(model.get("active-tabset")?.id).toBe("ts1");
    });
});

describe("state", () => {
    it("is frozen and structurally shared", () => {
        const model = createModel({
            version: 1,
            root: {
                type: "row",
                id: "root",
                children: [
                    {
                        type: "tabset",
                        id: "a",
                        children: [tab("One"), tab("Two")],
                    },
                    {
                        type: "row",
                        id: "r",
                        children: [
                            {
                                type: "tabset",
                                id: "b",
                                children: [tab("Three")],
                            },
                            {
                                type: "tabset",
                                id: "c",
                                children: [tab("Four")],
                            },
                        ],
                    },
                ],
            },
        });
        const before = model.state;
        expect(Object.isFrozen(before)).toBe(true);
        expect(Object.isFrozen(before.root.children)).toBe(true);
        must(model.run("tab.select", { tabId: "Two" }));
        const after = model.state;
        expect(after).not.toBe(before);
        expect(after.root).not.toBe(before.root);
        // the untouched subtree is the same object
        expect(after.root.children[1]).toBe(before.root.children[1]);
        expect(model.get("node-by", { id: "r" })).toBe(before.root.children[1]);
        expect(model.get("node-by", { id: "a" })).toBe(after.root.children[0]);
        expect(Object.isFrozen(model.get("node-by", { id: "a" }))).toBe(true);
    });

    it("keeps the id index current after moves (O(1) lookups)", () => {
        const model = model2();
        must(model.run("tab.move", { tabId: "Three", to: "ts0", index: 0 }));
        expect(model.get("node-by", { id: "ts1" })).toBeUndefined();
        expect(model.get("node-parent-by", { nodeId: "Three" })?.id).toBe(
            "ts0",
        );
        expect(model.get("layout-id-by", { nodeId: "Three" })).toBe("main");
        expect(render(model)).toBe("/ts0/t0[Three]*,/ts0/t1[One],/ts0/t2[Two]");
    });

    it('is("node-hidden-by-maximize") hides the other tabsets and the rows off the path', () => {
        const model = createModel({
            version: 1,
            root: {
                type: "row",
                children: [
                    { type: "tabset", id: "a", children: [tab("One")] },
                    {
                        type: "row",
                        id: "r",
                        children: [
                            { type: "tabset", id: "b", children: [tab("Two")] },
                            {
                                type: "tabset",
                                id: "c",
                                children: [tab("Three")],
                            },
                        ],
                    },
                ],
            },
        });
        expect(model.is("node-hidden-by-maximize", { nodeId: "a" })).toBe(
            false,
        );
        must(model.run("tabset.maximize", { tabsetId: "c", value: true }));
        expect(model.is("node-hidden-by-maximize", { nodeId: "a" })).toBe(true);
        expect(model.is("node-hidden-by-maximize", { nodeId: "b" })).toBe(true);
        expect(model.is("node-hidden-by-maximize", { nodeId: "c" })).toBe(
            false,
        );
        expect(model.is("node-hidden-by-maximize", { nodeId: "r" })).toBe(
            false,
        );
        expect(model.is("node-hidden-by-maximize", { nodeId: "One" })).toBe(
            false,
        );
    });

    it("lists every command with its schemas", () => {
        const model = model2();
        const names = model.get("commands").map((command) => command.name);
        expect(names).toEqual([
            "tab.add",
            "tab.select",
            "tab.close",
            "tab.move",
            "tab.set-data",
            "tab.set-component",
            "tab.pin",
            "tab.popout",
            "tab.configure",
            "tabset.activate",
            "tabset.maximize",
            "tabset.close",
            "tabset.move",
            "tabset.popout",
            "tabset.configure",
            "row.resize",
            "row.configure",
            "border.resize",
            "border.configure",
            "window.close",
            "window.configure",
            "layout.configure",
            "layout.load",
            "batch",
        ]);
        for (const command of model.get("commands")) {
            expect(command.description.length).toBeGreaterThan(20);
            expect(command.payloadSchema).toMatchObject({ type: "object" });
            expect(command.resultSchema).toMatchObject({ type: "object" });
        }
    });
});

describe("a middleware typed by the registry", () => {
    it("reads typed payloads", () => {
        type Types = { tabs: { note: { text: string } } };
        const model = createModel<Types>({
            version: 1,
            root: {
                type: "row",
                children: [{ type: "tabset", id: "t", children: [] }],
            },
        });
        const guard: Middleware<Types> = (ctx, next) => {
            if (ctx.command === "tab.add") {
                return next();
            }
            return next();
        };
        model.use(guard);
        expect(
            model.run("tab.add", {
                component: "note",
                label: "note",
                data: { text: "hi" },
                to: "main",
            }).ok,
        ).toBe(true);
    });
});

describe("review regressions", () => {
    it("runs the commands a middleware queued even when a listener throws", () => {
        const model = model2();
        const remove = model.use((ctx, next) => {
            if (ctx.command === "tab.select" && !ctx.dryRun) {
                model.run("tabset.activate", { tabsetId: "ts1" });
            }
            return next();
        });
        const unsubscribe = model.subscribe((event) => {
            if (event.command === "tab.select") {
                throw new Error("listener");
            }
        });
        expect(() => model.run("tab.select", { tabId: "Two" })).toThrowError(
            "listener",
        );
        remove();
        unsubscribe();
        expect(model.get("active-tabset")?.id).toBe("ts1");
    });

    it("copies the data and defaults it is given: never freezes or shares them", () => {
        const data = { name: "One", nested: { count: 1 } };
        const defaults = { tab: { enablePopout: true } };
        const model = createModel({
            version: 1,
            defaults,
            root: {
                type: "row",
                children: [
                    {
                        type: "tabset",
                        id: "ts0",
                        children: [
                            { id: "a", component: "x", label: "x", data },
                        ],
                    },
                ],
            },
        });
        expect(Object.isFrozen(data)).toBe(false);
        expect(Object.isFrozen(defaults)).toBe(false);
        data.nested.count = 2;
        defaults.tab.enablePopout = false;
        expect(model.get("node-by", { id: "a" })).toMatchObject({
            data: { nested: { count: 1 } },
        });
        expect(model.state.defaults.tab?.enablePopout).toBe(true);

        const added = { name: "Two" };
        must(
            model.run("tab.add", {
                id: "b",
                component: "x",
                label: "x",
                data: added,
                to: "ts0",
            }),
        );
        expect(Object.isFrozen(added)).toBe(false);
        const updated = { name: "Uno" };
        must(model.run("tab.set-data", { tabId: "a", data: updated }));
        updated.name = "changed";
        expect(model.get("node-by", { id: "a" })).toMatchObject({
            data: { name: "Uno" },
        });

        const unfrozen = createModel(tabsets(["One"]), { freeze: false });
        const shared = { name: "Shared" };
        must(
            unfrozen.run("tab.add", {
                id: "s",
                component: "x",
                label: "x",
                data: shared,
                to: "ts0",
            }),
        );
        shared.name = "leaked";
        expect(unfrozen.get("node-by", { id: "s" })).toMatchObject({
            data: { name: "Shared" },
        });
    });

    it("layout.load never reuses an id of the layout it replaces for a node it creates", () => {
        const model = createModel({
            version: 1,
            root: {
                type: "row",
                children: [
                    { type: "tabset", id: "tabset-1", children: [tab("One")] },
                ],
            },
        });
        const result = must(
            model.run("layout.load", {
                layout: {
                    version: 1,
                    root: { type: "row", id: "r", children: [] },
                },
            }),
        );
        const created = model.get("tabsets")[0]?.id;
        expect(created).toBeDefined();
        expect(created).not.toBe("tabset-1");
        expect(result.removedNodeIds).toContain("tabset-1");
        expect(result.addedNodeIds).toContain(created);
    });

    it("keeps pinned tabs out of borders", () => {
        const model = createModel({
            ...tabsets(["One"]),
            borders: [{ location: "left", children: [tab("B")] }],
        });
        expect(
            model.run("tab.add", {
                component: "x",
                label: "x",
                pinned: true,
                to: "border_left",
            }),
        ).toMatchObject({
            ok: false,
            error: { code: "refused", path: "/pinned" },
        });
        expect(model.run("tab.pin", { tabId: "B", value: false }).ok).toBe(
            true,
        );
        expect(() =>
            createModel({
                ...tabsets(["One"]),
                borders: [
                    {
                        location: "left",
                        children: [tab("B", { pinned: true })],
                    },
                ],
            }),
        ).toThrowError(/borders\/0\/children\/0\/pinned/);
    });
});

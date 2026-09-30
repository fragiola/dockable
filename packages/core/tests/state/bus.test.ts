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
        const to = model.tabsets()[0]?.id ?? "";
        const asked = model.can("tab.add", { component: "x", to });
        const added = model.run("tab.add", { component: "x", to });
        expect(asked.ok && added.ok && asked.value.tab).toBe(
            added.ok ? added.value.tab : "",
        );
    });

    it("hands out frozen schemas from commands()", () => {
        const model = model2();
        const info = model.commands().find((c) => c.name === "tab.select");
        expect(Object.isFrozen(info?.payloadSchema)).toBe(true);
        expect(Object.isFrozen(info?.payloadSchema.required)).toBe(true);
    });

    it("runs through detached methods (`const { run } = model`)", () => {
        const model = model2();
        const { run, can, dispatch, subscribe, use } = model;
        const events: string[] = [];
        subscribe((event) => events.push(event.command));
        use((_ctx, next) => next());
        const tabId = model.tabs()[1]?.id ?? "";
        expect(can("tab.select", { tab: tabId }).ok).toBe(true);
        expect(run("tab.select", { tab: tabId }).ok).toBe(true);
        expect(
            dispatch({ command: "tab.close", payload: { tab: tabId } }).ok,
        ).toBe(true);
        expect(events).toEqual(["tab.select", "tab.close"]);
    });

    it("never throws on bad input", () => {
        const model = model2();
        expect(model.run("tab.nope" as "tab.close", { tab: "One" })).toEqual({
            ok: false,
            error: {
                code: "unknown_command",
                message: 'unknown command "tab.nope"',
            },
        });
        expect(model.run("tab.close", { tab: 3 } as never)).toEqual({
            ok: false,
            error: {
                code: "invalid_payload",
                message: "must be a string",
                path: "/tab",
                issues: [{ path: "/tab", message: "must be a string" }],
            },
        });
        expect(
            model.run("tab.close", { tab: "x", extra: 1 } as never),
        ).toMatchObject({
            ok: false,
            error: {
                code: "invalid_payload",
                path: "/extra",
                message: "is not allowed",
            },
        });
        expect(model.run("tab.close", { tab: "missing" })).toEqual({
            ok: false,
            error: {
                code: "not_found",
                message: 'no tab "missing"',
                path: "/tab",
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
        const tabId = model.tabs()[0]?.id ?? "";
        const meta = { source: "assistant" };
        expect(
            model.dispatch(
                { command: "tab.close", payload: { tab: tabId } },
                { meta },
            ),
        ).toMatchObject({ ok: false, error: { code: "vetoed" } });
        expect(
            model.dispatch(
                { command: "tab.select", payload: { tab: tabId } },
                { meta },
            ).ok,
        ).toBe(true);
        expect(seen).toEqual([meta, meta]);
        expect(events).toEqual([meta]);
        // the input cannot carry it
        expect(
            model.dispatch({
                command: "tab.close",
                payload: { tab: tabId },
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
                path: "/payload/tab",
                message: "is required",
            },
        });
        expect(
            model.dispatch({
                command: "tab.close",
                payload: { tab: "One" },
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
                            '{"command":"tab.select","payload":{"tab":"Two"}}',
                        ),
                    ),
                ),
            ),
        ).toEqual({
            ok: true,
            value: { tab: "Two" },
        });
    });

    it("points a transient batch's refused step at its command, and dispatch at /transient", () => {
        const model = model2();
        expect(
            model.run(
                "batch",
                {
                    commands: [
                        { command: "tab.select", payload: { tab: "Two" } },
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
                payload: { tab: "Two" },
                transient: true,
            }),
        ).toMatchObject({ ok: false, error: { path: "/transient" } });
    });

    it("rejects a transient run of a command that is not transient-capable", () => {
        const model = model2();
        expect(
            model.run("tab.select", { tab: "Two" }, { transient: true }),
        ).toMatchObject({
            ok: false,
            error: { code: "invalid_payload", path: "/transient" },
        });
        expect(
            model.run(
                "row.resize",
                { row: "root", weights: [1, 2] },
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
        expect(model.run("tab.close", { tab: "One" })).toEqual({
            ok: false,
            error: { code: "vetoed", message: "closing is disabled" },
        });
        expect(model.get("One")).toBeDefined();
    });

    it("rewrites the payload, which is validated again", () => {
        const model = model2();
        model.use((ctx, next) => {
            if (ctx.command === "tab.select") {
                ctx.payload = { tab: "One" };
            }
            if (ctx.command === "tab.close") {
                ctx.payload = { tab: 5 } as never;
            }
            return next();
        });
        must(model.run("tab.select", { tab: "Two" }));
        expect(model.selectedTab("ts0")?.id).toBe("One");
        expect(model.run("tab.close", { tab: "One" })).toMatchObject({
            ok: false,
            error: { code: "invalid_payload", path: "/tab" },
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
        expect(model.run("tab.select", { tab: "Two" })).toEqual({
            ok: true,
            value: { tab: "Two" },
        });
        expect(model.run("tab.close", { tab: "missing" }).ok).toBe(false);
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
        must(model.run("tab.select", { tab: "Two" }));
        remove();
        must(model.run("tab.select", { tab: "One" }));
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
                { command: "tab.select", payload: { tab: "Two" } },
                { command: "tab.close", payload: { tab: "One" } },
            ],
        });
        expect(result).toMatchObject({ ok: false, error: { code: "vetoed" } });
        expect(seen).toEqual([
            "batch",
            "tab.select (in batch)",
            "tab.close (in batch)",
        ]);
        expect(model.selectedTab("ts0")?.id).toBe("One");
    });

    it("reports a throw as middleware_error and commits nothing", () => {
        const model = model2();
        const before = model.state;
        model.use(() => {
            throw new Error("boom");
        });
        expect(model.run("tab.select", { tab: "Two" })).toEqual({
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
                seen = ctx.get("n")?.type;
            }
            return next();
        });
        must(
            model.run("batch", {
                commands: [
                    {
                        command: "tab.add",
                        payload: { id: "n", component: "x", to: "ts0" },
                    },
                    { command: "tab.select", payload: { tab: "n" } },
                ],
            }),
        );
        expect(seen).toBe("tab");
    });
});

describe("dry run", () => {
    it("can commits nothing and emits nothing", () => {
        const model = model2();
        const listener = vi.fn();
        model.subscribe(listener);
        const before = model.state;
        expect(model.can("tab.close", { tab: "One" })).toEqual({
            ok: true,
            value: { tab: "One" },
        });
        expect(
            model.can("tab.move", { tab: "One", to: "ts1", location: "top" })
                .ok,
        ).toBe(true);
        expect(model.state).toBe(before);
        expect(listener).not.toHaveBeenCalled();
    });

    it("can goes through the middleware with dryRun", () => {
        const model = model2();
        const flags: boolean[] = [];
        model.use((ctx, next) => {
            flags.push(ctx.dryRun);
            return ctx.command === "tab.move" ? veto() : next();
        });
        expect(model.can("tab.move", { tab: "One", to: "ts1" })).toMatchObject({
            ok: false,
            error: { code: "vetoed" },
        });
        expect(flags).toEqual([true]);
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
                { command: "tab.select", payload: { tab: "Two" } },
                { command: "tab.move", payload: { tab: "Three", to: "ts0" } },
                { command: "tab.close", payload: { tab: "nope" } },
            ],
        });
        expect(result).toEqual({
            ok: false,
            error: {
                code: "not_found",
                message: 'no tab "nope"',
                path: "/commands/2/payload/tab",
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

    it("emits one event that lists its commands, flattened", () => {
        const model = model2();
        const events: CommandEvent[] = [];
        model.subscribe((event) => events.push(event));
        must(
            model.run("batch", {
                commands: [
                    { command: "tab.select", payload: { tab: "Two" } },
                    {
                        command: "batch",
                        payload: {
                            commands: [
                                {
                                    command: "tab.close",
                                    payload: { tab: "Three" },
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
                payload: { tab: "Two" },
                result: { tab: "Two" },
            },
            {
                command: "tab.close",
                payload: { tab: "Three" },
                result: { tab: "Three" },
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
                { row: "root", weights: [1, 3] },
                { transient: true, meta: { from: "test" } },
            ),
        );
        expect(events[0]).toMatchObject({
            command: "row.resize",
            payload: { row: "root", weights: [1, 3] },
            result: { row: "root" },
            before,
            after: model.state,
            transient: true,
            meta: { from: "test" },
        });
    });

    it("fires for a command that changed nothing, with before === after", () => {
        const model = model2();
        must(model.run("tab.select", { tab: "One" }));
        const events: CommandEvent[] = [];
        model.subscribe((event) => events.push(event));
        must(model.run("tab.select", { tab: "One" }));
        expect(events).toHaveLength(1);
        expect(events[0]?.before).toBe(events[0]?.after);
    });

    it("unsubscribes", () => {
        const model = model2();
        const listener = vi.fn();
        const unsubscribe = model.subscribe(listener);
        unsubscribe();
        must(model.run("tab.select", { tab: "Two" }));
        expect(listener).not.toHaveBeenCalled();
    });

    it("keeps notifying after a listener throws, then rethrows", () => {
        const model = model2();
        const second = vi.fn();
        model.subscribe(() => {
            throw new Error("listener");
        });
        model.subscribe(second);
        expect(() => model.run("tab.select", { tab: "Two" })).toThrowError(
            "listener",
        );
        expect(second).toHaveBeenCalledTimes(1);
        expect(model.selectedTab("ts0")?.id).toBe("Two");
    });
});

describe("re-entrancy", () => {
    it("a run from a listener applies at once; its event follows the current one", () => {
        const model = model2();
        const order: string[] = [];
        model.subscribe((event) => {
            order.push(`a:${event.command}`);
            if (event.command === "tab.select") {
                const result = model.run("tabset.activate", { tabset: "ts1" });
                order.push(`ran:${result.ok}`);
            }
        });
        model.subscribe((event) => order.push(`b:${event.command}`));
        must(model.run("tab.select", { tab: "Two" }));
        expect(order).toEqual([
            "a:tab.select",
            "ran:true",
            "b:tab.select",
            "a:tabset.activate",
            "b:tabset.activate",
        ]);
        expect(model.activeTabset()?.id).toBe("ts1");
    });

    it("a run from a middleware is queued after the current command", () => {
        const model = model2();
        const commands: string[] = [];
        model.subscribe((event) => commands.push(event.command));
        let queued: unknown;
        const remove = model.use((ctx, next) => {
            if (ctx.command === "tab.select" && !ctx.dryRun) {
                queued = model.run("tabset.activate", { tabset: "ts1" });
            }
            return next();
        });
        must(model.run("tab.select", { tab: "Two" }));
        remove();
        expect(queued).toMatchObject({ ok: false, error: { code: "queued" } });
        expect(commands).toEqual(["tab.select", "tabset.activate"]);
        expect(model.activeTabset()?.id).toBe("ts1");
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
        must(model.run("tab.select", { tab: "Two" }));
        const after = model.state;
        expect(after).not.toBe(before);
        expect(after.root).not.toBe(before.root);
        // the untouched subtree is the same object
        expect(after.root.children[1]).toBe(before.root.children[1]);
        expect(model.get("r")).toBe(before.root.children[1]);
        expect(model.get("a")).toBe(after.root.children[0]);
        expect(Object.isFrozen(model.get("a"))).toBe(true);
    });

    it("keeps the id index current after moves (O(1) lookups)", () => {
        const model = model2();
        must(model.run("tab.move", { tab: "Three", to: "ts0", index: 0 }));
        expect(model.get("ts1")).toBeUndefined();
        expect(model.parentOf("Three")?.id).toBe("ts0");
        expect(model.layoutOf("Three")).toBe("main");
        expect(render(model)).toBe("/ts0/t0[Three]*,/ts0/t1[One],/ts0/t2[Two]");
    });

    it("isHiddenByMaximize hides the other tabsets and the rows off the path", () => {
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
        expect(model.isHiddenByMaximize("a")).toBe(false);
        must(model.run("tabset.maximize", { tabset: "c", value: true }));
        expect(model.isHiddenByMaximize("a")).toBe(true);
        expect(model.isHiddenByMaximize("b")).toBe(true);
        expect(model.isHiddenByMaximize("c")).toBe(false);
        expect(model.isHiddenByMaximize("r")).toBe(false);
        expect(model.isHiddenByMaximize("One")).toBe(false);
    });

    it("lists every command with its schemas", () => {
        const model = model2();
        const names = model.commands().map((command) => command.name);
        expect(names).toEqual([
            "tab.add",
            "tab.select",
            "tab.close",
            "tab.move",
            "tab.update",
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
        for (const command of model.commands()) {
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
                model.run("tabset.activate", { tabset: "ts1" });
            }
            return next();
        });
        const unsubscribe = model.subscribe((event) => {
            if (event.command === "tab.select") {
                throw new Error("listener");
            }
        });
        expect(() => model.run("tab.select", { tab: "Two" })).toThrowError(
            "listener",
        );
        remove();
        unsubscribe();
        expect(model.activeTabset()?.id).toBe("ts1");
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
                        children: [{ id: "a", component: "x", data }],
                    },
                ],
            },
        });
        expect(Object.isFrozen(data)).toBe(false);
        expect(Object.isFrozen(defaults)).toBe(false);
        data.nested.count = 2;
        defaults.tab.enablePopout = false;
        expect(model.get("a")).toMatchObject({
            data: { nested: { count: 1 } },
        });
        expect(model.state.defaults.tab?.enablePopout).toBe(true);

        const added = { name: "Two" };
        must(
            model.run("tab.add", {
                id: "b",
                component: "x",
                data: added,
                to: "ts0",
            }),
        );
        expect(Object.isFrozen(added)).toBe(false);
        const updated = { name: "Uno" };
        must(
            model.run("tab.update", {
                tab: "a",
                component: "x",
                data: updated,
            }),
        );
        updated.name = "changed";
        expect(model.get("a")).toMatchObject({ data: { name: "Uno" } });

        const unfrozen = createModel(tabsets(["One"]), { freeze: false });
        const shared = { name: "Shared" };
        must(
            unfrozen.run("tab.add", {
                id: "s",
                component: "x",
                data: shared,
                to: "ts0",
            }),
        );
        shared.name = "leaked";
        expect(unfrozen.get("s")).toMatchObject({ data: { name: "Shared" } });
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
        const created = model.tabsets()[0]?.id;
        expect(created).toBeDefined();
        expect(created).not.toBe("tabset-1");
        expect(result.removed).toContain("tabset-1");
        expect(result.added).toContain(created);
    });

    it("keeps pinned tabs out of borders", () => {
        const model = createModel({
            ...tabsets(["One"]),
            borders: [{ location: "left", children: [tab("B")] }],
        });
        expect(
            model.run("tab.add", {
                component: "x",
                pinned: true,
                to: "border_left",
            }),
        ).toMatchObject({
            ok: false,
            error: { code: "refused", path: "/pinned" },
        });
        expect(model.run("tab.pin", { tab: "B", value: false }).ok).toBe(true);
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

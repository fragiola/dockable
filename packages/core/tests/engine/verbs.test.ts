// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
    createLayoutEngine,
    createModel,
    type LayoutEngine,
    type LayoutJson,
    MAIN_LAYOUT,
    veto,
} from "../../src";
import {
    ENGINE_ACTION_KEYS,
    ENGINE_GET_KEYS,
    ENGINE_IS_KEYS,
} from "../../src/engine/verbs";
import { recordCommands, twoTabsets } from "./fixture";

const COMMAND_NAMES = createModel()
    .get("commands")
    .map((command) => command.name);

const engines: LayoutEngine[] = [];
afterEach(() => {
    for (const engine of engines.splice(0)) engine.adapter.dispose();
    document.body.replaceChildren();
});

const withBorder: LayoutJson = {
    ...structuredClone(twoTabsets),
    defaults: { tab: { enablePopout: true } },
    borders: [
        {
            id: "left",
            location: "left",
            mode: "overlay",
            selected: 0,
            children: [{ id: "b0", component: "test" }],
        },
    ],
};

function setup(supportsPopout = true) {
    const model = createModel(structuredClone(withBorder));
    const commands = recordCommands(model);
    const engine = createLayoutEngine({ model, popout: { supportsPopout } });
    engines.push(engine);
    return { model, engine, commands };
}

/** pops `node` out and returns the engine of its window */
function popoutEngine(engine: LayoutEngine, node: string): LayoutEngine {
    const popped = engine.run("popout", { node });
    if (!popped.ok) throw new Error(popped.error.message);
    const sub = engine.adapter.createPopoutEngine(popped.value.window);
    engines.push(sub);
    return sub;
}

describe("engine.run / can / check", () => {
    it("popout: check says what run would do, and does nothing", () => {
        const { model, engine, commands } = setup();
        expect(engine.check("popout", { node: "t2" })).toMatchObject({
            ok: true,
            value: { window: expect.any(String) },
        });
        expect(commands).toEqual([]);
        expect(model.state.windows).toEqual([]);
    });

    it("popout: refused where popouts are not supported, and for what is not a tab or a tabset", () => {
        const unsupported = setup(false);
        expect(unsupported.engine.run("popout", { node: "t2" })).toMatchObject({
            ok: false,
            error: { code: "refused" },
        });
        expect(unsupported.commands).toEqual([]);
        const { engine } = setup();
        expect(engine.check("popout", { node: "row" })).toMatchObject({
            ok: false,
            error: { code: "not_found" },
        });
    });

    it("popout and dock-back go through the model's middleware", () => {
        const { model, engine } = setup();
        const remove = model.use((ctx, next) =>
            ctx.command === "tab.popout" || ctx.command === "window.close"
                ? veto("not now")
                : next(),
        );
        expect(engine.can("popout", { node: "t2" })).toBe(false);
        expect(engine.run("popout", { node: "t2" })).toMatchObject({
            ok: false,
            error: { code: "vetoed" },
        });
        remove();
        popoutEngine(engine, "t2");
        model.use((ctx, next) =>
            ctx.command === "window.close" ? veto("stay") : next(),
        );
        expect(engine.can("dock-back", { node: "t2" })).toBe(false);
        expect(engine.run("dock-back", { node: "t2" }).ok).toBe(false);
        expect(model.is("in-window", { node: "t2" })).toBe(true);
    });

    it("page-wide actions work from a popout window's engine", () => {
        const { model, engine } = setup();
        const sub = popoutEngine(engine, "ts0");
        expect(sub.is("main-layout")).toBe(false);
        expect(sub.is("popout-supported")).toBe(engine.is("popout-supported"));
        expect(sub.adapter.main).toBe(engine);

        expect(sub.can("dock-back", { node: "t0" })).toBe(true);
        expect(sub.run("dock-back", { node: "t0" })).toEqual({
            ok: true,
            value: { tabs: ["t0"] },
        });
        expect(model.get("layout-id", { node: "t0" })).toBe(MAIN_LAYOUT);
        expect(sub.run("popout", { node: "t2" }).ok).toBe(true);
        expect(sub.check("dock-back", { node: "t2" }).ok).toBe(true);
    });

    it("dock-back: refused for a node of the main layout", () => {
        const { engine } = setup();
        expect(engine.check("dock-back", { node: "t0" })).toMatchObject({
            ok: false,
            error: { code: "refused" },
        });
    });

    it("close-overlay-border: closes an open border with border.configure", () => {
        const { model, engine, commands } = setup();
        expect(engine.can("close-overlay-border", { border: "left" })).toBe(
            true,
        );
        expect(commands).toEqual([]);
        expect(engine.run("close-overlay-border", { border: "left" })).toEqual({
            ok: true,
            value: { border: "left" },
        });
        expect(commands.map((c) => c.command)).toEqual(["border.configure"]);
        expect(model.is("open", { border: "left" })).toBe(false);
        expect(
            engine.check("close-overlay-border", { border: "left" }),
        ).toMatchObject({ ok: false, error: { code: "refused" } });
        expect(
            engine.check("close-overlay-border", { border: "ts0" }),
        ).toMatchObject({ ok: false, error: { code: "not_found" } });
    });

    it("close-overlay-border: works from a popout window's engine (borders are the main layout's)", () => {
        const { model, engine } = setup();
        const sub = popoutEngine(engine, "t2");
        expect(sub.run("close-overlay-border", { border: "left" }).ok).toBe(
            true,
        );
        expect(model.is("open", { border: "left" })).toBe(false);
    });

    it("close-overlay-border: a vetoed close is reported, and the close key is not taken", () => {
        const { model, engine } = setup();
        model.use((ctx, next) =>
            ctx.command === "border.configure" ? veto("pinned open") : next(),
        );
        expect(
            engine.run("close-overlay-border", { border: "left" }),
        ).toMatchObject({ ok: false, error: { code: "vetoed" } });
        const root = document.body.appendChild(document.createElement("div"));
        engine.adapter.attachRoot(root);
        const button = root.appendChild(document.createElement("button"));
        button.id = engine.get("tab-button-id", { tab: "b0" });
        button.focus();
        let prevented = false;
        const handled = engine.adapter.handleOverlayKeyDown(
            {
                key: "Escape",
                ctrlKey: false,
                shiftKey: false,
                altKey: false,
                metaKey: false,
                preventDefault: () => {
                    prevented = true;
                },
            },
            "Escape",
        );
        expect(handled).toBe(false);
        expect(prevented).toBe(false);
        expect(model.is("open", { border: "left" })).toBe(true);
    });

    it("measure-and-position: always applies, takes no payload", () => {
        const { engine } = setup();
        expect(engine.can("measure-and-position")).toBe(true);
        expect(engine.run("measure-and-position")).toEqual({
            ok: true,
            value: {},
        });
    });

    it("an unknown action is refused, never thrown", () => {
        const { engine } = setup();
        const run = engine.run as (action: string) => { ok: boolean };
        expect(run("tab.close")).toMatchObject({
            ok: false,
            error: { code: "unknown_command" },
        });
    });

    it("the verbs are bound", () => {
        const { engine } = setup();
        const { run, can, check, get, is } = engine;
        expect(can("measure-and-position")).toBe(true);
        expect(check("measure-and-position").ok).toBe(true);
        expect(run("measure-and-position").ok).toBe(true);
        expect(get("splitter-size")).toBeGreaterThan(0);
        expect(is("main-layout")).toBe(true);
    });
});

describe("engine.get / is", () => {
    it("reads paths, DOM ids and size limits", () => {
        const { engine } = setup();
        engine.adapter.prepare();
        expect(engine.get("path", { node: "ts1" })).toBe("/ts1");
        expect(engine.get("tab-button-id", { tab: "t0" })).toMatch(/t0/);
        expect(engine.get("tab-panel-id", { tab: "t0" })).not.toBe(
            engine.get("tab-button-id", { tab: "t0" }),
        );
        expect(engine.get("size-limits", { node: "ts0" })).toMatchObject({
            minWidth: expect.any(Number),
            maxWidth: expect.any(Number),
        });
    });

    it("reads the document and window it renders in, once attached", () => {
        const { engine } = setup();
        expect(engine.get("owner-document")).toBeUndefined();
        engine.adapter.attachRoot(
            document.body.appendChild(document.createElement("div")),
        );
        expect(engine.get("owner-document")).toBe(document);
        expect(engine.get("owner-window")).toBe(window);
    });

    it("asks about panels and splitters", () => {
        const { model, engine } = setup();
        expect(engine.is("panel-visible", { tab: "t0" })).toBe(true);
        expect(engine.is("panel-visible", { tab: "t1" })).toBe(false);
        model.run("tabset.maximize", { tabset: "ts1", value: true });
        expect(engine.is("panel-visible", { tab: "t0" })).toBe(false);
        expect(engine.is("splitter-dragging")).toBe(false);
        engine.adapter.setSplitterDragging(true);
        expect(engine.is("splitter-dragging")).toBe(true);
        expect(engine.is("main-layout")).toBe(true);
        expect(engine.is("popout-supported")).toBe(true);
        expect(setup(false).engine.is("popout-supported")).toBe(false);
    });
});

describe("the key lists", () => {
    it("are kebab-case, without a dot: never a command name", () => {
        const keys = [
            ...ENGINE_ACTION_KEYS,
            ...ENGINE_GET_KEYS,
            ...ENGINE_IS_KEYS,
        ];
        for (const key of keys) {
            expect(key).toMatch(/^[a-z]+(-[a-z]+)*$/);
        }
        for (const name of COMMAND_NAMES) {
            expect(name === "batch" || name.includes(".")).toBe(true);
            expect(ENGINE_ACTION_KEYS).not.toContain(name);
        }
    });

    it("cover every action", () => {
        expect([...ENGINE_ACTION_KEYS].sort()).toEqual([
            "close-overlay-border",
            "dock-back",
            "focus-tabset",
            "measure-and-position",
            "popout",
        ]);
    });
});

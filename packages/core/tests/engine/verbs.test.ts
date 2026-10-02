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
import type {
    EngineActionKey,
    EngineGetKey,
    EngineGetMap,
    EngineIsKey,
} from "../../src/engine/verbs";
import type { NoPayload } from "../../src/state/queries";
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
            children: [{ id: "b0", component: "test", label: "test" }],
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
    const popped = engine.run("popout", { nodeId: node });
    if (!popped.ok) throw new Error(popped.error.message);
    const sub = engine.adapter.createPopoutEngine(popped.value.windowId);
    engines.push(sub);
    return sub;
}

describe("engine.run / can / check", () => {
    it("popout: check says what run would do, and does nothing", () => {
        const { model, engine, commands } = setup();
        expect(engine.check("popout", { nodeId: "t2" })).toMatchObject({
            ok: true,
            value: { windowId: expect.any(String) },
        });
        expect(commands).toEqual([]);
        expect(model.state.windows).toEqual([]);
    });

    it("popout: refused where popouts are not supported, and for what is not a tab or a tabset", () => {
        const unsupported = setup(false);
        expect(
            unsupported.engine.run("popout", { nodeId: "t2" }),
        ).toMatchObject({
            ok: false,
            error: { code: "refused" },
        });
        expect(unsupported.commands).toEqual([]);
        const { engine } = setup();
        expect(engine.check("popout", { nodeId: "row" })).toMatchObject({
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
        expect(engine.can("popout", { nodeId: "t2" })).toBe(false);
        expect(engine.run("popout", { nodeId: "t2" })).toMatchObject({
            ok: false,
            error: { code: "vetoed" },
        });
        remove();
        popoutEngine(engine, "t2");
        model.use((ctx, next) =>
            ctx.command === "window.close" ? veto("stay") : next(),
        );
        expect(engine.can("dock-back", { nodeId: "t2" })).toBe(false);
        expect(engine.run("dock-back", { nodeId: "t2" }).ok).toBe(false);
        expect(model.is("node-in-window", { nodeId: "t2" })).toBe(true);
    });

    it("page-wide actions work from a popout window's engine", () => {
        const { model, engine } = setup();
        const sub = popoutEngine(engine, "ts0");
        expect(sub.is("main-layout")).toBe(false);
        expect(sub.is("popout-supported")).toBe(engine.is("popout-supported"));
        expect(sub.adapter.main).toBe(engine);

        expect(sub.can("dock-back", { nodeId: "t0" })).toBe(true);
        expect(sub.run("dock-back", { nodeId: "t0" })).toEqual({
            ok: true,
            value: { tabIds: ["t0"] },
        });
        expect(model.get("layout-id-by", { nodeId: "t0" })).toBe(MAIN_LAYOUT);
        expect(sub.run("popout", { nodeId: "t2" }).ok).toBe(true);
        expect(sub.check("dock-back", { nodeId: "t2" }).ok).toBe(true);
    });

    it("dock-back: refused for a node of the main layout", () => {
        const { engine } = setup();
        expect(engine.check("dock-back", { nodeId: "t0" })).toMatchObject({
            ok: false,
            error: { code: "refused" },
        });
    });

    it("close-overlay-border: closes an open border with border.configure", () => {
        const { model, engine, commands } = setup();
        expect(engine.can("close-overlay-border", { borderId: "left" })).toBe(
            true,
        );
        expect(commands).toEqual([]);
        expect(
            engine.run("close-overlay-border", { borderId: "left" }),
        ).toEqual({
            ok: true,
            value: { borderId: "left" },
        });
        expect(commands.map((c) => c.command)).toEqual(["border.configure"]);
        expect(model.is("border-open", { borderId: "left" })).toBe(false);
        expect(
            engine.check("close-overlay-border", { borderId: "left" }),
        ).toMatchObject({ ok: false, error: { code: "refused" } });
        expect(
            engine.check("close-overlay-border", { borderId: "ts0" }),
        ).toMatchObject({ ok: false, error: { code: "not_found" } });
    });

    it("close-overlay-border: works from a popout window's engine (borders are the main layout's)", () => {
        const { model, engine } = setup();
        const sub = popoutEngine(engine, "t2");
        expect(sub.run("close-overlay-border", { borderId: "left" }).ok).toBe(
            true,
        );
        expect(model.is("border-open", { borderId: "left" })).toBe(false);
    });

    it("close-overlay-border: a vetoed close is reported, and the close key is not taken", () => {
        const { model, engine } = setup();
        model.use((ctx, next) =>
            ctx.command === "border.configure" ? veto("pinned open") : next(),
        );
        expect(
            engine.run("close-overlay-border", { borderId: "left" }),
        ).toMatchObject({ ok: false, error: { code: "vetoed" } });
        const root = document.body.appendChild(document.createElement("div"));
        engine.adapter.attachRoot(root);
        const button = root.appendChild(document.createElement("button"));
        button.id = engine.get("tab-button-dom-id-by", { tabId: "b0" });
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
        expect(model.is("border-open", { borderId: "left" })).toBe(true);
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
        expect(engine.get("layout-path-by", { nodeId: "ts1" })).toBe("/ts1");
        expect(engine.get("tab-button-dom-id-by", { tabId: "t0" })).toMatch(
            /t0/,
        );
        expect(engine.get("tab-panel-dom-id-by", { tabId: "t0" })).not.toBe(
            engine.get("tab-button-dom-id-by", { tabId: "t0" }),
        );
        expect(engine.get("flex-by", { nodeId: "ts0" })).toMatchObject({
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
        expect(engine.is("tab-panel-visible", { tabId: "t0" })).toBe(true);
        expect(engine.is("tab-panel-visible", { tabId: "t1" })).toBe(false);
        model.run("tabset.maximize", { tabsetId: "ts1", value: true });
        expect(engine.is("tab-panel-visible", { tabId: "t0" })).toBe(false);
        expect(engine.is("splitter-dragging")).toBe(false);
        engine.adapter.setSplitterDragging(true);
        expect(engine.is("splitter-dragging")).toBe(true);
        expect(engine.is("main-layout")).toBe(true);
        expect(engine.is("popout-supported")).toBe(true);
        expect(setup(false).engine.is("popout-supported")).toBe(false);
    });
});

describe("the layout rules", () => {
    it("flex-by: a row's or a tabset's flex grow (its weight, at least 1) and its min/max", () => {
        const json = structuredClone(twoTabsets);
        const [ts0, ts1] = json.root.children ?? [];
        if (ts0?.type !== "tabset" || ts1?.type !== "tabset") {
            throw new Error("two tabsets");
        }
        ts0.minWidth = 120;
        ts1.weight = 0.0005;
        const engine = createLayoutEngine({ model: createModel(json) });
        engines.push(engine);
        expect(engine.get("flex-by", { nodeId: "ts0" })).toMatchObject({
            grow: 50_000,
            minWidth: 120,
            maxWidth: 99999,
        });
        expect(engine.get("flex-by", { nodeId: "ts1" }).grow).toBe(1);
        expect(engine.get("flex-by", { nodeId: "row" }).grow).toBe(100_000);
        expect(engine.get("flex-by", { nodeId: "nope" })).toEqual({
            grow: 1,
            minWidth: 0,
            minHeight: 0,
            maxWidth: 99999,
            maxHeight: 99999,
        });
    });

    it("tab-tabbable: the selected tab, else the first one when none is selected", () => {
        const { model, engine } = setup();
        const tabbable = (tabId: string) =>
            engine.is("tab-tabbable", { tabId });
        expect(tabbable("t0")).toBe(true);
        expect(tabbable("t1")).toBe(false);
        model.run("tab.select", { tabId: "t1" });
        expect(tabbable("t0")).toBe(false);
        expect(tabbable("t1")).toBe(true);
        const added = model.run("tab.add", {
            component: "test",
            label: "b1",
            to: "left",
        });
        const b1 = added.ok ? added.value.tabId : "";
        model.run("tab.select", { tabId: "b0" });
        expect(tabbable("b0")).toBe(true);
        expect(tabbable(b1)).toBe(false);
        model.run("border.configure", { borderId: "left", open: false });
        expect(tabbable("b0")).toBe(true);
        expect(tabbable(b1)).toBe(false);
        expect(tabbable("nope")).toBe(false);
    });
});

const ACTION_KEYS = Object.keys({
    popout: true,
    "dock-back": true,
    "focus-tabset": true,
    "close-overlay-border": true,
    "measure-and-position": true,
} satisfies Record<EngineActionKey, true>);

const GET_INPUTS: {
    [K in EngineGetKey]: {
        required: NoPayload extends EngineGetMap[K]["payload"] ? false : true;
        fields: readonly (keyof EngineGetMap[K]["payload"])[];
    };
} = {
    "layout-path-by": { required: true, fields: ["nodeId"] },
    "tab-button-dom-id-by": { required: true, fields: ["tabId"] },
    "tab-panel-dom-id-by": { required: true, fields: ["tabId"] },
    "flex-by": { required: true, fields: ["nodeId"] },
    "overlay-placement-by": { required: true, fields: ["borderId"] },
    "splitter-size": { required: false, fields: [] },
    "owner-document": { required: false, fields: [] },
    "owner-window": { required: false, fields: [] },
};

const IS_KEYS = Object.keys({
    "popout-supported": true,
    "tab-panel-visible": true,
    "main-layout": true,
    "splitter-dragging": true,
    "border-shown": true,
    "tab-tabbable": true,
} satisfies Record<EngineIsKey, true>);

describe("the key lists", () => {
    it("are kebab-case, without a dot: never a command name", () => {
        const keys = [...ACTION_KEYS, ...Object.keys(GET_INPUTS), ...IS_KEYS];
        for (const key of keys) {
            expect(key).toMatch(/^[a-z]+(-[a-z]+)*$/);
        }
        for (const name of COMMAND_NAMES) {
            expect(name === "batch" || name.includes(".")).toBe(true);
            expect(ACTION_KEYS).not.toContain(name);
        }
    });

    it("cover every action", () => {
        expect([...ACTION_KEYS].sort()).toEqual([
            "close-overlay-border",
            "dock-back",
            "focus-tabset",
            "measure-and-position",
            "popout",
        ]);
    });

    it("read as a sentence: the key names its result, the payload whose", () => {
        // a get key that takes an id ends in `-by`, its payload is required, and its field
        // completes the key (`tab-panel-dom-id-by { tabId }`); any other key takes nothing
        for (const [key, { required, fields }] of Object.entries(GET_INPUTS)) {
            const fieldList: readonly string[] = fields;
            expect(key, key).not.toMatch(/-by-/);
            expect(required, key).toBe(key.endsWith("-by"));
            expect(fieldList.length > 0, key).toBe(required);
            for (const field of fieldList) {
                expect(field === "id" || field.endsWith("Id"), key).toBe(true);
            }
        }
        expect(IS_KEYS).toContain("tab-panel-visible");
    });
});

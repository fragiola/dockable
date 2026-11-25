import { Component, input } from "@angular/core";
import { createModel, type Model } from "@fragiola/dockable";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DOCKABLE } from "../src/public-api";
import { mustPath } from "./helpers";
import {
    recordCommands,
    render,
    settle,
    type Types,
    twoTabsets,
} from "./layout";

const popoutModel = (poppable = true) =>
    createModel<Types>({
        ...structuredClone(twoTabsets),
        defaults: { tab: { poppable } },
    });

@Component({
    imports: [DOCKABLE],
    template: `
        <div [dockableRoot]="model()" [supportsPopout]="supported()">
            <div dockableRow>
                <ng-template dockableRowChild let-node>
                    @if (node.type === "tabset") {
                        <div [dockableTabSet]="node">
                            <div dockableTabSetContent></div>
                            <button
                                dockablePopoutTrigger
                                #trigger="dockablePopoutTrigger"
                                [target]="target()"
                                [attr.aria-label]="trigger.state()?.mode === 'dock' ? 'Dock' : 'Pop out'"
                            ></button>
                        </div>
                    }
                </ng-template>
            </div>
        </div>
    `,
})
class TriggerLayout {
    readonly model = input.required<Model<Types>>();
    readonly supported = input(true);
    readonly target = input<"tab" | "tabset">("tab");
}

beforeEach(() => {
    vi.spyOn(window, "open").mockImplementation(() => null);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("[dockablePopoutTrigger]", () => {
    it("is a button that pops the selected tab out, through the model's commands", async () => {
        const model = popoutModel();
        const commands = recordCommands(model);
        await render(TriggerLayout, { model });
        const trigger = mustPath("/ts0/button/popout");
        expect(trigger).toHaveAttribute("type", "button");
        expect(trigger).toHaveAttribute("data-mode", "popout");
        expect(trigger).toHaveAttribute("data-target", "tab");
        expect(trigger).toHaveAttribute("aria-label", "Pop out");
        expect(trigger.style.display).toBe("");
        trigger.click();
        await settle();
        expect(commands.map((c) => c.command)).toContain("tab.popout");
        expect(window.open).toHaveBeenCalledTimes(1);
    });

    it("is hidden when the selected tab cannot pop out, or popouts are unsupported", async () => {
        await render(TriggerLayout, { model: popoutModel(false) });
        expect(mustPath("/ts0/button/popout").style.display).toBe("none");
        expect(mustPath("/ts0/button/popout")).not.toHaveAttribute("data-mode");
    });

    it("is hidden while popouts are unsupported", async () => {
        await render(TriggerLayout, {
            model: popoutModel(),
            supported: false,
        });
        expect(mustPath("/ts0/button/popout").style.display).toBe("none");
    });

    it("targets the whole tabset with target=tabset", async () => {
        const model = popoutModel();
        const commands = recordCommands(model);
        await render(TriggerLayout, { model, target: "tabset" });
        const trigger = mustPath("/ts0/button/popout");
        expect(trigger).toHaveAttribute("data-target", "tabset");
        trigger.click();
        await settle();
        expect(commands.map((c) => c.command)).toContain("tabset.popout");
    });
});

const borderModel = () =>
    createModel<Types>({
        ...structuredClone(twoTabsets),
        defaults: { tab: { poppable: true } },
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
    });

@Component({
    imports: [DOCKABLE],
    template: `
        <div [dockableRoot]="model()" [supportsPopout]="true">
            <div dockableBorders>
                <ng-template [dockableBordersBar]="model()" let-border>
                    <div [dockableBorder]="border">
                        <div dockableTabList>
                            <ng-template dockableTabListItem let-tab>
                                <div [dockableTab]="tab"></div>
                            </ng-template>
                        </div>
                        <button dockablePopoutTrigger [target]="target()" aria-label="Pop out"></button>
                    </div>
                </ng-template>
                <div dockableRow>
                    <ng-template dockableRowChild let-node>
                        @if (node.type === "tabset") {
                            <div [dockableTabSet]="node"><div dockableTabSetContent></div></div>
                        }
                    </ng-template>
                </div>
            </div>
        </div>
    `,
})
class BorderTriggerLayout {
    readonly model = input.required<Model<Types>>();
    readonly target = input<"tab" | "tabset">("tab");
}

describe("[dockablePopoutTrigger] in a border", () => {
    it("pops the border's selected tab out", async () => {
        const model = borderModel();
        const commands = recordCommands(model);
        await render(BorderTriggerLayout, { model });
        const trigger = mustPath("/border/bottom/button/popout");
        expect(trigger).toHaveAttribute("data-mode", "popout");
        expect(trigger.style.display).toBe("");
        trigger.click();
        await settle();
        expect(commands).toContainEqual(
            expect.objectContaining({
                command: "tab.popout",
                payload: expect.objectContaining({ tabId: "terminal" }),
            }),
        );
    });

    it("is hidden with target=tabset: a border is not a tabset", async () => {
        await render(BorderTriggerLayout, {
            model: borderModel(),
            target: "tabset",
        });
        expect(mustPath("/border/bottom/button/popout").style.display).toBe(
            "none",
        );
    });
});

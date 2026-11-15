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
